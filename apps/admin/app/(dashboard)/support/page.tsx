'use client';

export default function SupportPage() {
  return (
    <div>
      <h1>Support</h1>
      <p className="subtitle">Help running Kynren Ops.</p>
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>Need a hand?</div>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          For operational issues during a live event, contact the duty manager on the ops radio.
          For platform issues (login, data, the mobile app), email <a href="mailto:support@kynren.com">support@kynren.com</a>.
        </p>
        <p className="hint">Live Schedule and Kitchen update guests in real time — changes appear in the app within seconds.</p>
      </div>
    </div>
  );
}
