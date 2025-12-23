import React from 'react';
import { GraduationCap } from 'lucide-react';

const TutorView = () => (
  <div className="flex items-center justify-center h-96 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 animate-in fade-in duration-300">
    <div className="text-center">
      <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <h2 className="text-xl font-bold mb-2">AI Tutor</h2>
      <p>Coming soon...</p>
    </div>
  </div>
);

export default TutorView;