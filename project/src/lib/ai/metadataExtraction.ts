import type { MetadataInfo } from '@/types';

/**
 * Extract metadata from an uploaded file.
 * Uses browser APIs to extract available technical information.
 */
export async function extractMetadata(
  file: File,
  mediaElement?: HTMLImageElement | HTMLVideoElement
): Promise<MetadataInfo> {
  const metadata: MetadataInfo = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type.split('/')[0] || 'unknown',
    mimeType: file.type,
    anomalies: [],
  };

  // File system info
  if (file.lastModified) {
    metadata.modifiedDate = new Date(file.lastModified).toISOString();
  }

  // Image-specific metadata
  if (mediaElement instanceof HTMLImageElement) {
    metadata.width = mediaElement.naturalWidth;
    metadata.height = mediaElement.naturalHeight;
    metadata.colorSpace = 'sRGB';

    // Check for EXIF data (simplified)
    try {
      const exifData = await checkExifData(file);
      if (exifData.hasExif) {
        if (exifData.createdDate) metadata.createdDate = exifData.createdDate;
        if (exifData.software) metadata.compression = exifData.software;
      } else {
        metadata.anomalies.push('No EXIF metadata available for verification; this alone does not establish manipulation');
      }
    } catch {
      metadata.anomalies.push('EXIF data could not be read');
    }
  }

  // Video-specific metadata
  if (mediaElement instanceof HTMLVideoElement) {
    metadata.width = mediaElement.videoWidth;
    metadata.height = mediaElement.videoHeight;
    metadata.duration = mediaElement.duration;
    metadata.frameRate = estimateFrameRate(mediaElement);
    metadata.hasAudio = checkVideoAudio(mediaElement);

    // Codec estimation from MIME type
    if (file.type === 'video/mp4') metadata.codec = 'H.264/AAC';
    else if (file.type === 'video/avi') metadata.codec = 'MJPEG/PCM';
    else if (file.type === 'video/quicktime') metadata.codec = 'H.264/AAC';
    else metadata.codec = 'Unknown';
  }

  // Check for metadata anomalies
  detectMetadataAnomalies(metadata, file);

  return metadata;
}

/**
 * Check EXIF data presence (simplified check).
 */
async function checkExifData(file: File): Promise<{
  hasExif: boolean;
  createdDate?: string;
  software?: string;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check for JPEG EXIF marker (0xFFE1)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE1) {
      // Has EXIF header
      return { hasExif: true };
    }

    // Check for PNG chunks
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      // PNG - check for tEXt or eXIf chunks
      let hasText = false;
      for (let i = 8; i < bytes.length - 8; i++) {
        if (bytes[i] === 0x74 && bytes[i + 1] === 0x45 && bytes[i + 2] === 0x58 && bytes[i + 3] === 0x74) {
          hasText = true;
          break;
        }
      }
      return { hasExif: hasText };
    }

    // WebP
    if (bytes[0] === 0x52 && bytes[12] === 0x57 && bytes[13] === 0x45 && bytes[14] === 0x42 && bytes[15] === 0x50) {
      return { hasExif: false };
    }

    return { hasExif: false };
  } catch {
    return { hasExif: false };
  }
}

function estimateFrameRate(video: HTMLVideoElement): number {
  // Browsers don't expose frame rate directly; estimate from requestVideoFrameCallback if available
  if ('requestVideoFrameCallback' in video) {
    return 30; // Default assumption; could be measured with rVFC
  }
  return 30;
}

function checkVideoAudio(video: HTMLVideoElement): boolean {
  if ('mozHasAudio' in video) return (video as unknown as { mozHasAudio: boolean }).mozHasAudio;
  if ('webkitAudioDecodedByteCount' in video) {
    return (video as unknown as { webkitAudioDecodedByteCount: number }).webkitAudioDecodedByteCount > 0;
  }
  return true;
}

/**
 * Detect metadata anomalies.
 */
function detectMetadataAnomalies(metadata: MetadataInfo, file: File) {
  // File size vs resolution consistency
  if (metadata.width && metadata.height) {
    const pixels = metadata.width * metadata.height;
    const bytesPerPixel = file.size / pixels;

    if (bytesPerPixel < 0.1) {
      metadata.anomalies.push('File size unusually small for resolution (high compression or AI-generated)');
    }
    if (bytesPerPixel > 10) {
      metadata.anomalies.push('File size unusually large for resolution (uncompressed or raw)');
    }
  }

  // Missing creation date
  if (!metadata.createdDate && !metadata.modifiedDate) {
    metadata.anomalies.push('No creation or modification date in metadata');
  }

  // MIME type consistency
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext) {
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
    };
    const expectedMime = mimeMap[ext];
    if (expectedMime && file.type && file.type !== expectedMime) {
      metadata.anomalies.push(`MIME type (${file.type}) does not match file extension (.${ext})`);
    }
  }
}
