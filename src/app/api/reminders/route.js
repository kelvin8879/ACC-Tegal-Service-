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

// Helper to format date as DD/MM/YYYY in WIB (UTC+7)
const formatDdMmYyyy = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const localTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
    const day = String(localTime.getUTCDate()).padStart(2, '0');
    const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
    const year = localTime.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get('test') === 'true';

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
    const { data: rawOfficers, error: oError } = await supabase
      .from('officers')
      .select('*')
      .not('email', 'is', null)
      .neq('email', '');

    if (oError) throw oError;

    let officers = rawOfficers || [];

    const divisionParam = searchParams.get('division');
    if (divisionParam) {
      officers = officers.filter(o => o.division?.toLowerCase() === divisionParam.toLowerCase());
    }

    const officerIdParam = searchParams.get('officerId');
    if (officerIdParam) {
      officers = officers.filter(o => o.id === officerIdParam);
    }

    if (officers.length === 0) {
      return NextResponse.json({ message: 'No officers found matching the filter.' }, { status: 200 });
    }

    // 2. Fetch all prospects still in the 'Prospek' stage
    const { data: prospects, error: pError } = await supabase
      .from('prospects')
      .select('*')
      .eq('pipeline', 'Prospek');

    if (pError) throw pError;

    const activeProspects = prospects || [];

    if (activeProspects.length === 0) {
      return NextResponse.json({ message: 'No active prospects found in the Prospek stage.' }, { status: 200 });
    }

    // 3. Group prospects by officer_id (optionally bypassing the 3/7 day filter in test mode)
    const reminders = {}; // { [officerId]: { officer, prospects: [] } }

    for (const p of activeProspects) {
      if (!p.officer_id) continue;
      
      const age = getAgeInDays(p.created_at);
      if (isTest || age === 3 || age === 7) {
        const officer = officers.find(o => o.id === p.officer_id);
        if (officer) {
          if (!reminders[officer.id]) {
            reminders[officer.id] = { officer, prospects: [] };
          }
          reminders[officer.id].prospects.push({ ...p, age: isTest ? (age || 3) : age });
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

      // Construct HTML Cards matching the WhatsApp format
      const cardsHtml = officerProspects.map(p => {
        const prospectDate = formatDdMmYyyy(p.created_at);
        return `
        <div style="margin-bottom: 20px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc; border-left: 5px solid ${p.age >= 7 ? '#ef4444' : '#f59e0b'}; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="font-weight: 800; font-size: 0.95rem; color: #1e3a8a; margin-bottom: 12px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; letter-spacing: 0.03em;">
            📢 PROSPECT ORDER OPERATION (${prospectDate})
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; line-height: 1.5;">
            <tr>
              <td style="width: 120px; padding: 4px 0; font-weight: bold; color: #475569; vertical-align: top;">PENGAJUAN</td>
              <td style="padding: 4px 5px; color: #475569; vertical-align: top;">:</td>
              <td style="padding: 4px 0; font-weight: bold; color: #1e293b; vertical-align: top;">
                <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${p.pengajuan || 'Non Top Up'}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; vertical-align: top;">NAMA</td>
              <td style="padding: 4px 5px; color: #475569; vertical-align: top;">:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a; vertical-align: top;">${p.nama}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; vertical-align: top;">REFERRAL</td>
              <td style="padding: 4px 5px; color: #475569; vertical-align: top;">:</td>
              <td style="padding: 4px 0; color: #334155; vertical-align: top;">${officer.name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; vertical-align: top;">STATUS</td>
              <td style="padding: 4px 5px; color: #475569; vertical-align: top;">:</td>
              <td style="padding: 4px 0; color: #334155; vertical-align: top;">
                <span style="background: #f1f5f9; color: #334155; padding: 1px 6px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; border: 1px solid #e2e8f0;">${p.status || 'Open'}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; vertical-align: top;">ALAMAT</td>
              <td style="padding: 4px 5px; color: #475569; vertical-align: top;">:</td>
              <td style="padding: 4px 0; color: #334155; vertical-align: top;">${p.alamat || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #475569; vertical-align: top;">UMUR PROSPEK</td>
              <td style="padding: 4px 5px; color: #475569; vertical-align: top;">:</td>
              <td style="padding: 4px 0; font-weight: 800; color: ${p.age >= 7 ? '#ef4444' : '#d97706'}; vertical-align: top;">${p.age} Hari</td>
            </tr>
          </table>
          <div style="margin-top: 10px; padding: 10px; background-color: #ffffff; border-radius: 6px; border: 1px dashed #cbd5e1; font-size: 0.85rem;">
            <strong style="color: #475569;">NOTE:</strong> <span style="color: #0f172a; font-style: italic;">${p.note || '-'}</span>
          </div>
        </div>
        `;
      }).join('');

      // Complete HTML Template
      const teamName = `${officer.division || 'Operation'} Team - ACC Tegal`;
      const mailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #334155; line-height: 1.6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 25px; border-bottom: 2.5px solid #f1f5f9; padding-bottom: 18px;">
            <h2 style="color: #1e3a8a; margin: 0; font-size: 1.6rem; letter-spacing: 0.03em; font-weight: 800;">S.W.A.T - TEGAL</h2>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 0.9rem; font-weight: 500; letter-spacing: 0.01em;">Sistem Pengingat Tindak Lanjut Prospek</p>
          </div>
          
          <p style="font-size: 1rem; margin-top: 0;">Halo Rekan <strong>${officer.name}</strong>,</p>
          <p style="font-size: 0.95rem; color: #475569; margin-bottom: 20px;">Sistem mendeteksi bahwa Anda memiliki beberapa prospek yang belum dipindahkan ke tahapan <strong>Aplikasi IN</strong> selama lebih dari 3 hari. Mohon segera lakukan follow up:</p>
          
          <div style="margin: 20px 0;">
            ${cardsHtml}
          </div>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; margin: 25px 0; border-radius: 4px; font-size: 0.875rem; color: #1e40af; line-height: 1.5;">
            <strong>💡 Info Tindak Lanjut:</strong> Silakan login ke aplikasi S.W.A.T Tegal untuk melengkapi data registrasi atau memindahkan prospek di atas ke tahapan <em>Aplikasi IN</em> agar pengingat otomatis ini dihentikan.
          </div>
          
          <p style="margin-top: 25px; font-size: 0.95rem; margin-bottom: 0;">Terima kasih atas kerja samanya,</p>
          <p style="font-weight: bold; color: #1e3a8a; margin: 5px 0 0 0; font-size: 1rem;">${teamName}</p>
          
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
          <p style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin: 0;">
            Email ini dikirimkan secara otomatis oleh sistem S.W.A.T. Harap tidak membalas email ini.
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
