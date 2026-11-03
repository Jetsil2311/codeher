export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="skeleton h-9 w-64 rounded-full" />
      <div className="skeleton mt-3 h-4 w-80 max-w-full rounded-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-[1.4rem]" />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="skeleton h-72 rounded-[1.5rem]" />
        <div className="skeleton h-72 rounded-[1.5rem]" />
      </div>
    </div>
  );
}
