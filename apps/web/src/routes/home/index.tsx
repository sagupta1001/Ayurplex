import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useMedications } from '@/features/medications/useMedications';
import { MedicationList } from '@/features/medications/MedicationList';
import { useDueToday } from '@/features/doses/useDueToday';
import { DoseRow } from '@/features/doses/DoseRow';
import { useProfile } from '@/features/profiles/useProfile';
import { useTimezoneSync } from '@/features/profiles/useTimezoneSync';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { BellToggle } from '@/features/notifications/BellToggle';
import { StatusRing } from './StatusRing';

export function HomePage(): ReactElement {
  const { data: profile } = useProfile();
  useTimezoneSync();
  const timezone = profile?.timezone ?? 'UTC';
  const { medications } = useMedications();
  const { doses, takenCount, totalCount, markTaken } = useDueToday({ timezone });

  const medNameById = new Map(medications.map((m) => [m.id, m.name]));

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px 96px',
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1
            style={{
              fontFamily: 'Lexend, sans-serif',
              fontSize: 24,
              fontWeight: 600,
              color: '#092C4C',
              margin: 0,
            }}
          >
            Hello, {profile?.display_name ?? 'there'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellToggle />
            <SignOutButton />
          </div>
        </div>
        <StatusRing taken={takenCount} total={totalCount} />
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 18,
            color: '#092C4C',
            marginBottom: 12,
          }}
        >
          Today
        </h2>
        {doses.length === 0 ? (
          <p style={{ color: '#4D9999' }}>Nothing due today.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {doses.map((d) => (
              <DoseRow
                key={d.id}
                dose={d}
                medicationName={medNameById.get(d.medication_id) ?? 'Medication'}
                timezone={timezone}
                onMarkTaken={(id) => void markTaken(id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2
          style={{
            fontFamily: 'Lexend, sans-serif',
            fontSize: 18,
            color: '#092C4C',
            marginBottom: 12,
          }}
        >
          Medications
        </h2>
        <MedicationList medications={medications} />
      </section>

      <Link
        to="/upload-prescription"
        aria-label="Upload prescription"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 88,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: '#4D9999',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(77, 153, 153, 0.4)',
          fontFamily: 'Lexend, sans-serif',
        }}
      >
        Rx
      </Link>

      <Link
        to="/add-med"
        aria-label="Add medication"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: '#007972',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(0, 121, 114, 0.4)',
        }}
      >
        +
      </Link>
    </main>
  );
}

export default HomePage;
