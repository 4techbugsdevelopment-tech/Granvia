import PDFDocument from 'pdfkit';

export interface AgreementPdfData {
  agreementNumber: string;
  agreementVersion: string;
  generatedAt: Date;
  partnerName: string;
  partnerReference: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
}

function collectPdf(render: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: 'Granvia Associate Partner Agreement' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    doc.end();
  });
}

export function generateAgreementPdf(data: AgreementPdfData): Promise<Buffer> {
  return collectPdf((doc) => {
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f1e3c').text('GRANVIA', { align: 'center' });
    doc.moveDown(0.3).fontSize(15).text('ASSOCIATE PARTNER AGREEMENT', { align: 'center' });
    doc.moveDown().font('Helvetica').fontSize(9).fillColor('#334155');
    doc.text(`Agreement No: ${data.agreementNumber}`);
    doc.text(`Version: ${data.agreementVersion}`);
    doc.text(`Generated: ${data.generatedAt.toLocaleDateString('en-IN')}`);
    doc.moveDown();
    doc.fontSize(10.5).fillColor('#111827').text(
      `This Associate Partner Agreement (the “Agreement”) is entered into between Granvia and ${data.partnerName} (Associate Partner reference ${data.partnerReference}), residing at ${data.address}, ${data.city}, ${data.state}. Contact: ${data.mobile}; ${data.email}.`,
      { align: 'justify', lineGap: 3 },
    );
    const clauses = [
      ['1. Appointment and scope', 'The Associate Partner may access opportunities and provide services through Granvia subject to applicable assignments, verified onboarding information, platform policies, and written commercial terms. This Agreement does not guarantee any minimum assignment or income.'],
      ['2. Accuracy and compliance', 'The Associate Partner confirms that submitted profile, KYC, qualification, bank and document information is accurate and will promptly notify Granvia of material changes. The Associate Partner will comply with applicable law, site rules, safety requirements and lawful instructions.'],
      ['3. Independent obligations', 'Unless an assignment expressly states otherwise, the Associate Partner remains responsible for professional conduct, attendance, confidentiality, care of property, and performance of accepted responsibilities.'],
      ['4. Commercial terms', 'Assignment-specific duties, location, duration, attendance, compensation and payment conditions will be communicated separately. Where assignment terms conflict with this Agreement, the expressly agreed assignment terms govern only that assignment.'],
      ['5. Confidentiality and privacy', 'Confidential business, customer, site and personal information may be used only for the relevant Granvia purpose. Granvia will process personal information under its applicable privacy and security practices.'],
      ['6. Verification and approval', 'Digital signature completion does not itself activate or approve the account. Existing Granvia verification, review, approval, suspension and activation rules continue to apply.'],
      ['7. Electronic execution', 'The parties intend to execute this immutable version through a configured external electronic-signature service provider. Granvia will rely only on a signature result verified by its backend against that provider’s official specification.'],
      ['8. Entire version and changes', 'This document, identified by its agreement number and version, is the text presented for signature. A signed version will not be altered. Any later amendment or replacement requires an explicit new version or agreement workflow.'],
    ];
    for (const [heading, body] of clauses) {
      doc.moveDown(0.75).font('Helvetica-Bold').text(heading);
      doc.moveDown(0.2).font('Helvetica').text(body, { align: 'justify', lineGap: 2 });
    }
    doc.moveDown(1.2).font('Helvetica-Bold').text('Associate Partner');
    doc.font('Helvetica').text(data.partnerName);
    doc.text('Digital signature: To be completed through the configured ESP');
    doc.moveDown().fontSize(8).fillColor('#64748b').text(
      `Document identity: ${data.agreementNumber} / ${data.agreementVersion}. This PDF becomes immutable when eSign is initiated.`,
    );
  });
}

export function generateSandboxEvidencePdf(agreementNumber: string, originalHash: string): Promise<Buffer> {
  return collectPdf((doc) => {
    doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(28).text('TEST / NOT LEGALLY SIGNED', { align: 'center' });
    doc.moveDown(2).fillColor('#111827').fontSize(16).text('Granvia eSign Sandbox Evidence', { align: 'center' });
    doc.moveDown().font('Helvetica').fontSize(11).text(`Agreement: ${agreementNumber}`);
    doc.text(`Original SHA-256: ${originalHash}`);
    doc.text(`Sandbox completed: ${new Date().toISOString()}`);
    doc.moveDown().fillColor('#b91c1c').text('This file is development evidence only. It is not a digital signature and cannot activate a production account.', { align: 'justify' });
  });
}
