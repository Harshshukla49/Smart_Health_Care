import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { blogPosts } from '../data/demoData';

export function Blog() {
  return (
    <div>
      <PageHeader
        eyebrow="Blog"
        title="Insights on remote monitoring, design, and patient safety."
        description="Use the blog space for updates, thought leadership, and product communication around connected care."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {blogPosts.map((post) => (
          <Card key={post.id} className="overflow-hidden p-0">
            <div className="aspect-[16/10] overflow-hidden">
              <img src={post.image} alt={post.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
            </div>
            <div className="space-y-3 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Article</p>
              <h3 className="font-display text-2xl font-bold text-white">{post.title}</h3>
              <p className="text-sm leading-7 text-slate-300">{post.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
