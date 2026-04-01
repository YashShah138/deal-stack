import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePDF } from '@/lib/services/pdf-service';
import { buildInternalReportHTML } from '@/lib/templates/internal-report';
import { buildExternalReportHTML } from '@/lib/templates/external-report';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId, reportType } = await request.json();

  if (!reportType || !['internal', 'external'].includes(reportType)) {
    return NextResponse.json({ error: 'reportType must be "internal" or "external"' }, { status: 400 });
  }

  const html = reportType === 'internal'
    ? buildInternalReportHTML()
    : buildExternalReportHTML();

  const pdfBuffer = await generatePDF(html);

  // Upload to Supabase Storage
  const admin = createAdminClient();
  const storagePath = `${user.id}/${dealId || 'test'}/${reportType}-${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage
    .from('reports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);
    return NextResponse.json({ error: 'Upload failed', details: uploadError.message }, { status: 500 });
  }

  // Get signed URL (1 hour)
  const { data: signedUrlData } = await admin.storage
    .from('reports')
    .createSignedUrl(storagePath, 3600);

  // Record in pdf_reports (use admin client to bypass RLS for insert)
  await admin.from('pdf_reports').insert({
    user_id: user.id,
    deal_id: dealId || null,
    report_type: reportType,
    storage_path: storagePath,
    file_size_bytes: pdfBuffer.length,
  });

  return NextResponse.json({
    url: signedUrlData?.signedUrl,
    storagePath,
    size: pdfBuffer.length,
  });
}
