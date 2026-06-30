import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '../../../lib/supabase';

// Helper to calculate age in business days (shifting at 3 AM WIB)
const getAgeInDays = (createdAtStr) => {
  if (!createdAtStr) return 0;
  try {
    const now = new Date();
    const created = new Date(createdAtStr);
    
    // Shift both to UTC+7 (WIB), then apply 3-hour business day shift
    const localNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const shiftedNow = new Date(localNow.getTime() - (3 * 60 * 60 * 1000));
    const nowStr = shiftedNow.toISOString().split('T')[0];
    const nowDate = new Date(nowStr);

    const localCreated = new Date(created.getTime() + (7 * 60 * 60 * 1000));
    const shiftedCreated = new Date(localCreated.getTime() - (3 * 60 * 60 * 1000));
    const createdStr = shiftedCreated.toISOString().split('T')[0];
    const createdDate = new Date(createdStr);

    const diffTime = nowDate.getTime() - createdDate.getTime();
    if (diffTime < 0) return 0;
    
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (e) {
    console.error('Error calculating age in days:', e);
    return 0;
  }
};

export async function GET(request) {
  try {
    // Check SMTP configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return NextResponse.json(
        { error: 'SMTP credentials are not configured in .env.local' },
        { status: 500 }
      );
    }

    // 1. Fetch all officers with an email
    const { data: officers, error: oError } = await supabase
      .from('officers')
      .select('*')
      .not('email', 'is', null)
      .neq('email', '');

    if (oError) throw oError;

    if (!officers || officers.length === 0) {
      return NextResponse.json({ message: 'No officers with registered emails found.' }, { status: 200 });
    }

    // 2. Fetch all prospects still in the 'Prospek' stage
    const { data: prospects, error: pError } = await supabase
      .from('prospects')
      .select('*')
      .eq('pipeline', 'Prospek');

    if (pError) throw pError;

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ message: 'No active prospects found in the Prospek stage.' }, { status: 200 });
    }

    // 3. Group prospects that are exactly 3 or 7 days old by officer_id
    const reminders = {}; // { [officerId]: { officer, prospects: [] } }

    for (const p of prospects) {
      if (!p.officer_id) continue;
      
      const age = getAgeInDays(p.created_at);
      if (age === 3 || age === 7) {
        const officer = officers.find(o => o.id === p.officer_id);
        if (officer) {
          if (!reminders[officer.id]) {
            reminders[officer.id] = { officer, prospects: [] };
          }
          reminders[officer.id].prospects.push({ ...p, age });
        }
      }
    }

    const officerIdsToRemind = Object.keys(reminders);
    if (officerIdsToRemind.length === 0) {
      return NextResponse.json({ message: 'No prospects are exactly 3 or 7 days old today. No emails sent.' }, { status: 200 });
    }

    // 4. Configure Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '465'),
      secure: smtpPort === '465', // true for port 465, false for other ports (e.g. 587)
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false // Helps avoid SSL issues in local/dev environments
      }
    });

    const results = [];

    // 5. Send emails to each officer
    for (const officerId of officerIdsToRemind) {
      const { officer, prospects: officerProspects } = reminders[officerId];
      
      // Sort by age (newest first)
      officerProspects.sort((a, b) => a.age - b.age);

      // Construct HTML Table Rows
      const rowsHtml = officerProspects.map(p => `
        <tr>
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">${p.nama}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;"><span style="background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem;">${p.pengajuan || 'Non Top Up'}</span></td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-size: 0.9rem;">${p.alamat || '-'}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${p.age === 7 ? '#ef4444' : '#f59e0b'};">
            ${p.age} Hari
          </td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-size: 0.85rem; color: #64748b;">${p.note || '-'}</td>
        </tr>
      `).join('');

      // Complete HTML Template
      const mailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
            <h2 style="color: #1e3a8a; margin: 0; font-size: 1.5rem; letter-spacing: 0.02em;">S.W.A.T - TEGAL</h2>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 0.875rem;">Sistem Pengingat Tindak Lanjut Prospek</p>
          </div>
          
          <p>Halo <strong>${officer.name}</strong>,</p>
          <p>Sistem mendeteksi bahwa Anda memiliki beberapa prospek yang sudah terdaftar selama <strong>3 hari / 7 hari</strong> namun belum dipindahkan ke tahapan <strong>Aplikasi IN</strong>. Mohon segera lakukan tindak lanjut:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <thead>
              <tr style="background-color: #1e3a8a; color: white;">
                <th style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align: left;">Nama Customer</th>
                <th style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align: left;">Pengajuan</th>
                <th style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align: left;">Alamat</th>
                <th style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align: center;">Umur Prospek</th>
                <th style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align: left;">Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 15px; margin: 20px 0; border-radius: 0 8px 8px 0; font-size: 0.875rem; color: #1e40af;">
            <strong>💡 Info:</strong> Silakan login ke aplikasi untuk melengkapi data registrasi atau mengubah status prospek ini menjadi <em>Aplikasi IN</em> agar tidak masuk kembali ke daftar pengingat berikutnya.
          </div>
          
          <p style="margin-top: 25px;">Terima kasih atas kerja samanya,</p>
          <p style="font-weight: bold; color: #1e3a8a; margin: 0;">Operational Team</p>
          
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
          <p style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin: 0;">
            Email ini dikirimkan secara otomatis oleh sistem. Harap tidak membalas email ini.
          </p>
        </div>
      `;

      const mailOptions = {
        from: smtpFrom,
        to: officer.email,
        subject: `⚠️ [Reminder Follow-Up] Anda memiliki prospek 3 / 7 Hari yang belum diproses`,
        html: mailHtml,
      };

      await transporter.sendMail(mailOptions);
      results.push({ officerName: officer.name, email: officer.email, count: officerProspects.length });
    }

    return NextResponse.json({
      message: 'Reminder emails processed successfully.',
      sentReminders: results
    }, { status: 200 });

  } catch (error) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
