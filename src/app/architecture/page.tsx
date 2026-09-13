"use client";
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function ArchitecturePage() {
  return (
    <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <h1 className="text-2xl font-bold mb-4">System Architecture</h1>
      <div className="border rounded-lg overflow-hidden bg-surface-2">
        <Image
          src="/bharat_banking_updated_architecture.svg"
          alt="Banking Architecture"
          width={1200}
          height={800}
          className="object-contain"
        />
      </div>
      <p className="mt-4 text-fg-muted">
        The above diagram illustrates the static mock‑data flow used for the hackathon prototype. All backend endpoints serve static JSON files from the <code className="bg-surface-3 px-1 py-0.5 rounded">public/mock</code> directory.
      </p>
    </motion.div>
  );
}
