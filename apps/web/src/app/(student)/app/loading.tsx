export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8" aria-busy="true">
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="skeleton h-72 rounded-[1.75rem] lg:row-span-2 lg:h-auto" />
        <div className="skeleton h-36 rounded-[1.5rem]" />
        <div className="skeleton h-36 rounded-[1.5rem]" />
      </div>
      <div className="skeleton mt-10 h-6 w-48 rounded-full" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-[1.5rem]" />)}
      </div>
    </div>
  );
}
