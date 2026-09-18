import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../prisma';
import { PRIVATE_ROOT } from '../utils/fileStorage';
import { HttpError } from '../utils/http';

const OFFER_ROOT = path.join(PRIVATE_ROOT, 'hiring-documents');

function cleanPathPart(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Associate';
}

function formatDate(value?: Date | null): string {
  return value ? value.toLocaleDateString('en-IN') : '';
}

function formatMoney(value: unknown): string {
  if (value == null) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineValue(value: string | null | undefined, fallback = ''): string {
  return value?.trim() || fallback;
}

function collectPdf(render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: 'Offer of Engagement' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    doc.end();
  });
}

async function buildOfferLetterPdf(applicationId: string): Promise<{ buffer: Buffer; associateName: string }> {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      job: {
        include: {
          company: true,
          site: true,
        },
      },
    },
  });
  if (!application || application.status !== 'hired') throw new HttpError(404, 'Hired application not found.');

  const profile = await prisma.guardProfile.findUnique({ where: { userId: application.guardUserId } });
  if (profile?.verificationStatus !== 'verified') {
    throw new HttpError(403, 'Offer letter is available only after Associate verification.');
  }

  const associateName = lineValue(profile.fullName, 'Associate Partner');
  const address = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ');
  const assignment = application.job.title || application.job.category || application.job.guardType || 'Associate Partner';
  const site = application.job.site;
  const company = application.job.company;
  const deputedAt = [
    site?.siteName,
    site?.address,
    site?.city,
    site?.state,
    site?.pincode,
  ].filter(Boolean).join(', ') || company?.companyName || 'designated worksite';
  const effectiveDate = formatDate(application.job.startDate) || formatDate(application.reviewedAt) || formatDate(new Date());
  const salary = formatMoney(application.job.salaryAmount);

  const buffer = await collectPdf((doc) => {
    doc.font('Helvetica').fontSize(10).fillColor('#111827');
    doc.text(`Date: ${formatDate(new Date())}`, { align: 'right' });
    doc.moveDown(1.4);
    doc.text('To,');
    doc.moveDown(0.35);
    doc.font('Helvetica-Bold').text(associateName);
    doc.font('Helvetica').text(`Address: ${address || '____________________________'}`);
    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(12).text('SUB: OFFER OF ENGAGEMENT', { align: 'center', underline: true });
    doc.moveDown();
    doc.font('Helvetica').fontSize(10).text(`Dear ${associateName},`);
    doc.moveDown();
    doc.text(
      `The management pleased in offering you a temporary contractual assignment as ${assignment}. Please note that the assignment terms contained in this letter are subject to Company policy.`,
      { align: 'justify', lineGap: 3 },
    );
    doc.moveDown();
    doc.text(
      `You will be detailed & deputed at ${deputedAt} with effect from ${effectiveDate} and with compensation of Rs.${salary || '_________________'} CTC P.M.`,
      { align: 'justify', lineGap: 3 },
    );
    doc.moveDown();
    doc.text('On the date of your joining, please ensure to submit the following documents to our office:');
    doc.moveDown(0.4);
    [
      'A copy of your letter of appointment from the previous employer',
      'Four recent passport-sized colour photographs.',
      'Information on your blood group.',
      'A copy of your Age Proof Certificate.',
      'A copy of your ID Proof Certificate (PAN, AADHAR, PASSPORT)',
      'Educational Certificates (Class Xth and above) - both original & photocopies.',
      'Medical Fitness Certificate in original.',
      'No Criminal Record from local Police Station. / Self Declaration',
      'Copy of Address Proof.',
      'Copy of Relieving Letter / Experience Certificate from the previous employer.',
      'Copy of Salary Certificate / TDS Certificate / Total earnings of the Financial Year from the previous employer.',
    ].forEach((item, index) => doc.text(`${index + 1}. ${item}`, { lineGap: 2 }));
    doc.moveDown();
    doc.text(
      'The detailed contractual Letter of Assignment will be issued only after your reporting at the designated worksite so may be instructed. We look forward to your joining our team for a long and successful association.',
      { align: 'justify', lineGap: 3 },
    );
    doc.moveDown();
    doc.text(
      'In event you fail to provide the aforementioned documents within 7 days of receipt of this letter and/or any of the information so may be provided by you found wrong, this Offer stands cancelled/ rescinded.',
      { align: 'justify', lineGap: 3 },
    );
    doc.moveDown(1.2);
    doc.text('Yours Sincerely,');
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').text('For ASPL,');
    doc.moveDown(3);
    doc.font('Helvetica').text('Authorized Officer');
    doc.moveUp(4.4);
    doc.text('RECEIVED & ACCEPTED', 360);
    doc.moveDown(0.7);
    doc.text('The above terms are agreeable', 360);
    doc.moveDown(2.2);
    doc.text(`I will join on and from ${effectiveDate || '_________'}`, 360);
    doc.moveDown(2);
    doc.text('Signature of Associate', 360);
  });

  return { buffer, associateName };
}

export async function ensureOfferLetterForApplication(applicationId: string): Promise<string> {
  const existing = await prisma.notification.findFirst({
    where: { type: `hiring_offer_letter:${applicationId}` },
    select: { message: true },
  });
  const existingPath = existing?.message?.match(/\[offer_letter_path:([^\]]+)\]/)?.[1];
  if (existingPath) {
    const absoluteExisting = path.resolve(PRIVATE_ROOT, existingPath);
    const relative = path.relative(PRIVATE_ROOT, absoluteExisting);
    if (!relative.startsWith('..') && !path.isAbsolute(relative) && fs.existsSync(absoluteExisting)) {
      return absoluteExisting;
    }
  }

  const { buffer, associateName } = await buildOfferLetterPdf(applicationId);
  const folder = path.join(OFFER_ROOT, cleanPathPart(associateName));
  const filename = `Offer letter - ${applicationId}.pdf`;
  const absolutePath = path.join(folder, filename);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(absolutePath, buffer);
  return absolutePath;
}

export async function latestOfferLetterForAssociate(guardUserId: string): Promise<string> {
  const application = await prisma.jobApplication.findFirst({
    where: { guardUserId, status: 'hired' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (!application) throw new HttpError(404, 'Offer letter not found.');
  return ensureOfferLetterForApplication(application.id);
}

export async function offerLetterForAssociateApplication(guardUserId: string, applicationId: string): Promise<string> {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, guardUserId, status: 'hired' },
    select: { id: true },
  });
  if (!application) throw new HttpError(404, 'Offer letter not found.');
  return ensureOfferLetterForApplication(application.id);
}
