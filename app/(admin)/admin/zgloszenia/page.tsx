export default function AdminQueuePage() {
  // Real queue arrives in Phase 4. Phase 1 only stands the segment up so the
  // 404-for-wrong-role behaviour is verifiable end-to-end.
  return (
    <section className="stack-lg">
      <h1>Kolejka zgłoszeń</h1>
      <div className="card empty">
        <p>Brak zgłoszeń w systemie.</p>
      </div>
    </section>
  );
}
