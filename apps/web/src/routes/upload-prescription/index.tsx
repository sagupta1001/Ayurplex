import { useState, useRef } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePrescriptionUpload } from '@/features/prescriptions/usePrescriptionUpload';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadPrescriptionRoute(): ReactElement {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  const { phase, error, prescriptionId, startUpload, reset } =
    usePrescriptionUpload();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSizeError(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileSizeError('Image must be smaller than 10MB. Please choose a smaller file.');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    await startUpload(selectedFile);
  }

  // Navigate to review screen once parsing is done
  if (phase === 'done' && prescriptionId) {
    navigate(`/upload-prescription/review/${prescriptionId}`, { replace: true });
  }

  const isLoading = phase === 'uploading' || phase === 'creating' || phase === 'parsing';

  const loadingMessage =
    phase === 'uploading'
      ? 'Uploading image...'
      : phase === 'creating'
        ? 'Saving prescription...'
        : phase === 'parsing'
          ? 'Analyzing prescription...'
          : '';

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px',
        fontFamily: 'Roboto, sans-serif',
        minHeight: '100vh',
        background: '#F5FAF9',
      }}
    >
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: '#007972',
          fontFamily: 'Roboto, sans-serif',
          fontSize: 16,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← Back
      </button>

      <h1
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: '#092C4C',
          margin: '0 0 8px',
        }}
      >
        Upload Prescription
      </h1>
      <p style={{ color: '#4D9999', margin: '0 0 24px', fontSize: 14 }}>
        Take a photo of your prescription and we'll extract the medication details for you.
      </p>

      {/* File input area */}
      {previewUrl ? (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <img
            src={previewUrl}
            alt="Prescription preview"
            style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 12, objectFit: 'contain' }}
          />
          <button
            onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
            style={{
              marginTop: 8,
              background: 'none',
              border: 'none',
              color: '#4D9999',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'Roboto, sans-serif',
            }}
          >
            Change image
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => !isLoading && fileInputRef.current?.click()}
            disabled={isLoading}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 16px',
              border: '2px dashed #4D9999',
              borderRadius: 16,
              background: '#FFFFFF',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 36 }}>📷</span>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14, fontWeight: 500, color: '#092C4C' }}>
              Take a photo
            </span>
          </button>
          <button
            type="button"
            onClick={() => !isLoading && galleryInputRef.current?.click()}
            disabled={isLoading}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 16px',
              border: '2px dashed #4D9999',
              borderRadius: 16,
              background: '#FFFFFF',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 36 }}>🖼️</span>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14, fontWeight: 500, color: '#092C4C' }}>
              Choose from gallery
            </span>
          </button>
        </div>
      )}

      {/* Camera input - capture forces camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {/* Gallery input - no capture = opens file/gallery picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* File size error */}
      {fileSizeError && (
        <p role="alert" style={{ color: '#C62828', fontSize: 14, margin: '0 0 16px' }}>
          {fileSizeError}
        </p>
      )}

      {/* Upload error */}
      {phase === 'error' && error && (
        <div style={{ marginBottom: 16 }}>
          <p role="alert" style={{ color: '#C62828', fontSize: 14, margin: '0 0 8px' }}>
            {error}
          </p>
          <button
            onClick={() => {
              reset();
              setSelectedFile(null);
              setPreviewUrl(null);
            }}
            style={{
              background: 'none',
              border: '1px solid #007972',
              color: '#007972',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'Roboto, sans-serif',
              fontSize: 14,
              marginRight: 8,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/add-med')}
            style={{
              background: 'none',
              border: '1px solid #4D9999',
              color: '#4D9999',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'Roboto, sans-serif',
              fontSize: 14,
            }}
          >
            Enter Manually
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '16px 0', marginBottom: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #E0E0E0',
              borderTopColor: '#007972',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <p style={{ color: '#4D9999', fontSize: 14, margin: 0 }}>{loadingMessage}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Upload button */}
      {selectedFile && !isLoading && phase !== 'error' && (
        <button
          onClick={handleUpload}
          style={{
            width: '100%',
            padding: '14px 0',
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Lexend, sans-serif',
            cursor: 'pointer',
          }}
        >
          Upload & Analyze
        </button>
      )}

      <Link
        to="/add-med"
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: 24,
          fontFamily: 'Roboto, sans-serif',
          fontSize: 15,
          color: '#007972',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        Or add manually
      </Link>
    </main>
  );
}

export default UploadPrescriptionRoute;
