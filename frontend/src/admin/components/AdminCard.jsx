import React from 'react';

const AdminCard = ({ children, className = '' }) => (
  <div
    className={`relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-md shadow-[0_18px_45px_rgba(15,23,42,0.95)] ${className}`}
  >
    <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(circle_at_top_left,#22c55e,transparent_55%),radial-gradient(circle_at_bottom_right,#6366f1,transparent_55%)]" />
    <div className="relative">{children}</div>
  </div>
);

export default AdminCard;

