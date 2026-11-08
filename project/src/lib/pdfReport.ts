import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult } from '@/types';

/**
 * Generate a professional PDF forensic report.
 */
export function generatePdfReport(result: AnalysisResult): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = 0;

  // === HEADER ===
  doc.setFillColor(10, 14, 23);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(0, 240, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('DeepGuard', margin, 18);

  doc.setFontSize(9);
  doc.setTextColor(150, 160, 180);
  doc.setFont('helvetica', 'normal');
  doc.text('AI-Based Deepfake Detection & Digital Media Forensics', margin, 25);

  doc.setFontSize(9);
  doc.text(`Report ID: ${result.analysisId}`, pageWidth - margin, 18, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 25, { align: 'right' });

  y = 45;

  // === RESULT BANNER ===
  const isManipulated = result.result === 'manipulated';
  const isInconclusive = result.result === 'inconclusive';
  const resultColor = isManipulated ? [255, 51, 102] : isInconclusive ? [255, 170, 0] : [0, 136, 136];
  doc.setFillColor(resultColor[0], resultColor[1], resultColor[2]);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(
    isManipulated ? 'POTENTIALLY MANIPULATED MEDIA' : isInconclusive ? 'INCONCLUSIVE ASSESSMENT' : 'AUTHENTIC MEDIA',
    margin + 5,
    y + 12
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Manipulation Prob: ${(result.modelPrediction * 100).toFixed(1)}%  |  Confidence: ${(result.confidence * 100).toFixed(1)}%  |  Risk: ${result.riskScore}/100`,
    pageWidth - margin - 5,
    y + 12,
    { align: 'right' }
  );

  y += 28;

  // === FILE INFORMATION ===
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. File Information', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Property', 'Value']],
    body: [
      ['Analysis ID', result.analysisId],
      ['File Name', result.fileName],
      ['Media Type', result.mediaType.toUpperCase()],
      ['File Size', `${(result.metadataInfo.fileSize / 1024 / 1024).toFixed(2)} MB`],
      ['MIME Type', result.metadataInfo.mimeType],
      ['Resolution', result.metadataInfo.width ? `${result.metadataInfo.width}x${result.metadataInfo.height}` : 'N/A'],
      ...(result.metadataInfo.duration ? [['Duration', `${result.metadataInfo.duration.toFixed(1)}s`]] : []),
      ...(result.metadataInfo.codec ? [['Codec', result.metadataInfo.codec]] : []),
      ...(result.metadataInfo.frameRate ? [['Frame Rate', `${result.metadataInfo.frameRate} fps`]] : []),
      ['Analysis Date', new Date(result.timestamp).toLocaleString()],
      ['Processing Time', `${(result.processingTimeMs / 1000).toFixed(2)}s`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [0, 240, 255], textColor: [10, 14, 23], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // === PREDICTION SUMMARY ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. AI Prediction Summary', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Interpretation']],
    body: [
      ['Prediction', isManipulated ? 'Manipulated' : isInconclusive ? 'Inconclusive' : 'Authentic', isManipulated ? 'Model detected manipulation' : isInconclusive ? 'Ambiguous evidence or low confidence' : 'No manipulation detected'],
      ['Manipulation Probability', `${(result.modelPrediction * 100).toFixed(1)}%`, result.modelPrediction > 0.6 ? 'High manipulation probability' : result.modelPrediction > 0.4 ? 'Moderate manipulation probability' : 'Low manipulation probability'],
      ['Confidence', `${(result.confidence * 100).toFixed(1)}%`, result.confidence > 0.8 ? 'High confidence' : result.confidence > 0.6 ? 'Moderate confidence' : 'Low confidence'],
      ['Risk Score', `${result.riskScore}/100`, result.riskScore > 60 ? 'High risk' : result.riskScore > 40 ? 'Moderate risk' : 'Low risk'],
      ['CNN Visual Score', `${(result.visualAnalysis.score * 100).toFixed(0)}%`, result.visualAnalysis.score > 0.5 ? 'Visual artifacts detected' : 'No significant visual artifacts'],
      ['Temporal Score', result.temporalAnalysis.available ? `${(result.temporalAnalysis.consistencyScore * 100).toFixed(0)}%` : 'N/A', result.temporalAnalysis.available ? (result.temporalAnalysis.consistencyScore > 0.5 ? 'Temporal inconsistencies found' : 'Consistent temporal patterns') : 'Not applicable for images'],
      ['Audio Score', result.audioAnalysis.available ? `${(result.audioAnalysis.syntheticProbability * 100).toFixed(0)}%` : 'N/A', result.audioAnalysis.available ? (result.audioAnalysis.syntheticProbability > 0.5 ? 'Audio anomalies detected' : 'Audio appears natural') : 'No audio track'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [0, 240, 255], textColor: [10, 14, 23], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // === EVIDENCE FUSION ===
  if (y > pageHeight - 60) { doc.addPage(); y = margin; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Evidence Fusion Analysis', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Evidence Source', 'Score', 'Weight', 'Contribution']],
    body: result.evidenceFusion.evidenceBreakdown.map((e) => [
      e.source,
      `${(e.score * 100).toFixed(1)}%`,
      `${(e.weight * 100).toFixed(1)}%`,
      `${(e.contribution * 100).toFixed(2)}%`,
    ]),
    foot: [['Combined Score', '', '', `${(result.evidenceFusion.combinedScore * 100).toFixed(2)}%`]],
    theme: 'striped',
    headStyles: { fillColor: [0, 240, 255], textColor: [10, 14, 23], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    footStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontSize: 9, fontStyle: 'bold' },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // === FORENSIC INDICATORS ===
  if (result.forensicIndicators.length > 0) {
    if (y > pageHeight - 60) { doc.addPage(); y = margin; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('4. Forensic Indicators', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Indicator', 'Severity', 'Value', 'Description']],
      body: result.forensicIndicators.map((ind) => [
        ind.name,
        ind.severity.toUpperCase(),
        `${(ind.value * 100).toFixed(0)}%`,
        ind.description,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [255, 170, 0], textColor: [10, 14, 23], fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [60, 60, 60] },
      margin: { left: margin, right: margin },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // === VISUAL ANALYSIS ===
  if (y > pageHeight - 80) { doc.addPage(); y = margin; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('5. Visual Artifact Analysis', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Artifact Type', 'Score', 'Status']],
    body: [
      ['Texture Consistency', `${(result.visualAnalysis.textureScore * 100).toFixed(0)}%`, result.visualAnalysis.textureScore > 0.5 ? 'Suspicious' : 'Normal'],
      ['Lighting Consistency', `${(result.visualAnalysis.lightingScore * 100).toFixed(0)}%`, result.visualAnalysis.lightingScore > 0.5 ? 'Suspicious' : 'Normal'],
      ['Blending Artifacts', `${(result.visualAnalysis.blendingScore * 100).toFixed(0)}%`, result.visualAnalysis.blendingScore > 0.5 ? 'Suspicious' : 'Normal'],
      ['Noise Distribution', `${(result.visualAnalysis.noiseScore * 100).toFixed(0)}%`, result.visualAnalysis.noiseScore > 0.5 ? 'Suspicious' : 'Normal'],
      ['Facial Features', `${(result.visualAnalysis.facialFeatureScore * 100).toFixed(0)}%`, result.visualAnalysis.facialFeatureScore > 0.5 ? 'Suspicious' : 'Normal'],
      ['Compression Artifacts', `${(result.visualAnalysis.compressionScore * 100).toFixed(0)}%`, result.visualAnalysis.compressionScore > 0.5 ? 'Suspicious' : 'Normal'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [0, 240, 255], textColor: [10, 14, 23], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Findings
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Findings:', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  result.visualAnalysis.findings.forEach((finding) => {
    if (y > pageHeight - 20) { doc.addPage(); y = margin; }
    const lines = doc.splitTextToSize(`• ${finding}`, contentWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 6;

  // === TEMPORAL ANALYSIS ===
  if (result.temporalAnalysis.available) {
    if (y > pageHeight - 60) { doc.addPage(); y = margin; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('6. Temporal Analysis (Video)', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value', 'Interpretation']],
      body: [
        ['Frames Analyzed', String(result.temporalAnalysis.frameCount), 'Total frames extracted from video'],
        ['Consistency Score', `${(result.temporalAnalysis.consistencyScore * 100).toFixed(0)}%`, result.temporalAnalysis.consistencyScore > 0.5 ? 'Inconsistent patterns detected' : 'Consistent patterns'],
        ['Flicker Score', `${(result.temporalAnalysis.flickerScore * 100).toFixed(0)}%`, result.temporalAnalysis.flickerScore > 0.5 ? 'Unusual flickering detected' : 'Normal flicker pattern'],
        ['Motion Score', `${(result.temporalAnalysis.motionScore * 100).toFixed(0)}%`, result.temporalAnalysis.motionScore > 0.5 ? 'Jerky motion detected' : 'Smooth motion'],
        ['Suspicious Frames', String(result.temporalAnalysis.suspiciousFrames.length), result.temporalAnalysis.suspiciousFrames.length > 0 ? 'Frames flagged for review' : 'No suspicious frames'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [255, 170, 0], textColor: [10, 14, 23], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
      margin: { left: margin, right: margin },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // === AUDIO ANALYSIS ===
  if (y > pageHeight - 60) { doc.addPage(); y = margin; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('7. Audio Analysis', margin, y);
  y += 6;

  if (result.audioAnalysis.available) {
    autoTable(doc, {
      startY: y,
      head: [['Feature', 'Score', 'Interpretation']],
      body: [
        ['Spectral Analysis', `${(result.audioAnalysis.spectralScore * 100).toFixed(0)}%`, result.audioAnalysis.spectralScore > 0.5 ? 'Unusual spectral patterns' : 'Normal spectral characteristics'],
        ['Pitch Analysis', `${(result.audioAnalysis.pitchScore * 100).toFixed(0)}%`, result.audioAnalysis.pitchScore > 0.5 ? 'Unnatural pitch patterns' : 'Natural pitch variation'],
        ['Noise Analysis', `${(result.audioAnalysis.noiseScore * 100).toFixed(0)}%`, result.audioAnalysis.noiseScore > 0.5 ? 'Abnormal noise patterns' : 'Normal noise floor'],
        ['AV Synchronization', `${(result.audioAnalysis.syncScore * 100).toFixed(0)}%`, result.audioAnalysis.syncScore > 0.5 ? 'Sync inconsistencies detected' : 'Audio-video in sync'],
        ['Synthetic Probability', `${(result.audioAnalysis.syntheticProbability * 100).toFixed(0)}%`, result.audioAnalysis.syntheticProbability > 0.5 ? 'Possible synthetic audio' : 'Audio appears natural'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [168, 85, 247], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
      margin: { left: margin, right: margin },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize('Audio analysis was not available for this media. This may be due to the absence of an audio track or the media type being an image.', contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;
  }

  // === METADATA ===
  if (y > pageHeight - 60) { doc.addPage(); y = margin; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('8. Metadata & Forensic Information', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Metadata Field', 'Value']],
    body: [
      ['File Name', result.metadataInfo.fileName],
      ['File Size', `${(result.metadataInfo.fileSize / 1024 / 1024).toFixed(2)} MB`],
      ['MIME Type', result.metadataInfo.mimeType],
      ['Resolution', result.metadataInfo.width ? `${result.metadataInfo.width}x${result.metadataInfo.height}` : 'N/A'],
      ...(result.metadataInfo.duration ? [['Duration', `${result.metadataInfo.duration.toFixed(1)}s`]] : []),
      ...(result.metadataInfo.codec ? [['Codec', result.metadataInfo.codec]] : []),
      ...(result.metadataInfo.frameRate ? [['Frame Rate', `${result.metadataInfo.frameRate} fps`]] : []),
      ...(result.metadataInfo.hasAudio !== undefined ? [['Audio Track', result.metadataInfo.hasAudio ? 'Present' : 'Absent']] : []),
      ...(result.metadataInfo.createdDate ? [['Created Date', result.metadataInfo.createdDate]] : []),
      ...(result.metadataInfo.modifiedDate ? [['Modified Date', result.metadataInfo.modifiedDate]] : []),
    ],
    theme: 'striped',
    headStyles: { fillColor: [0, 240, 255], textColor: [10, 14, 23], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    margin: { left: margin, right: margin },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  if (result.metadataInfo.anomalies.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(200, 100, 0);
    doc.text('Metadata Observations:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    result.metadataInfo.anomalies.forEach((anomaly) => {
      if (y > pageHeight - 20) { doc.addPage(); y = margin; }
      const lines = doc.splitTextToSize(`• ${anomaly}`, contentWidth - 5);
      doc.text(lines, margin + 2, y);
      y += lines.length * 5;
    });
    y += 6;
  }

  // === HEATMAP ===
  if (result.heatmapDataUrl) {
    if (y > pageHeight - 100) { doc.addPage(); y = margin; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('9. Grad-CAM Heatmap (Explainable AI)', margin, y);
    y += 8;

    try {
      const imgWidth = contentWidth * 0.7;
      const imgHeight = imgWidth * 0.75;
      doc.addImage(result.heatmapDataUrl, 'PNG', margin + (contentWidth - imgWidth) / 2, y, imgWidth, imgHeight);
      y += imgHeight + 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const descLines = doc.splitTextToSize(
        'The heatmap above shows regions that most influenced the model\'s prediction. Red areas indicate higher importance for the classification decision.',
        contentWidth
      );
      doc.text(descLines, margin, y);
      y += descLines.length * 4 + 5;
    } catch {
      doc.setFontSize(9);
      doc.text('Heatmap image could not be embedded in the report.', margin, y);
      y += 6;
    }
  }

  // === DISCLAIMER ===
  if (y > pageHeight - 60) { doc.addPage(); y = margin; }

  y += 5;
  doc.setFillColor(255, 245, 230);
  doc.roundedRect(margin, y, contentWidth, 35, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(200, 100, 0);
  doc.text('DISCLAIMER', margin + 5, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const disclaimer = 'AI predictions are probabilistic and should not be treated as conclusive proof without further investigation. The results provided by DeepGuard are based on machine learning models and forensic heuristics that may produce false positives or false negatives. This report is for informational purposes only and should be used as part of a comprehensive investigation. DeepGuard is not liable for decisions made based solely on this report.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth - 10);
  doc.text(disclaimerLines, margin + 5, y + 14);

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('DeepGuard AI Forensics - Confidential', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(`DeepGuard_Report_${result.analysisId}.pdf`);
}
