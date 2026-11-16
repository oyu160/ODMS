// Хуудасны өгөгдөл ачаалагдаж байх үед харагдах хэлбэр (skeleton)
export function PageSkeleton() {
  const bar = "animate-pulse rounded-lg bg-slate-200/80";
  return (
    <div aria-busy="true" aria-label="Ачаалж байна">
      <div className={`${bar} mb-2 h-3 w-40`} />
      <div className={`${bar} mb-2 h-8 w-72`} />
      <div className={`${bar} mb-7 h-4 w-96`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-8 w-16`} />
            <div className={`${bar} h-3 w-32`} />
          </div>
        ))}
      </div>
      <div className="card mt-5 space-y-4 p-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <div className={`${bar} h-4 w-20`} />
            <div className={`${bar} h-4 flex-1`} />
            <div className={`${bar} h-4 w-24`} />
          </div>
        ))}
      </div>
    </div>
  );
}
