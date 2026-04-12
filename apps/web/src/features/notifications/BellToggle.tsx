import type { ReactElement } from 'react';
import { usePushSubscription, type PushState } from './usePushSubscription';

const BELL_STYLES: Record<string, React.CSSProperties> = {
  base: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 24,
    padding: 8,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

function bellLabel(state: PushState): string {
  switch (state) {
    case 'subscribed': return 'Disable reminders';
    case 'denied': return 'Notifications blocked';
    case 'unsupported': return 'Push not supported';
    default: return 'Enable reminders';
  }
}

function bellIcon(state: PushState): string {
  // Unicode bell characters
  return state === 'subscribed' ? '\u{1F514}' : '\u{1F515}';
}

export function BellToggle(): ReactElement {
  const { state, subscribe, unsubscribe } = usePushSubscription();

  const disabled = state === 'loading' || state === 'unsupported' || state === 'denied';

  const handleClick = () => {
    if (state === 'subscribed') {
      void unsubscribe();
    } else {
      void subscribe();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={bellLabel(state)}
      title={bellLabel(state)}
      style={{
        ...BELL_STYLES.base,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {bellIcon(state)}
    </button>
  );
}
