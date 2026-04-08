import React from 'react';

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl animate-fadeUp">
        {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</p> : null}
        <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-5xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{description}</p> : null}
      </div>
      {action ? <div className="animate-fadeUp md:pb-1">{action}</div> : null}
    </div>
  );
}
