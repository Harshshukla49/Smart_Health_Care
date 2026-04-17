import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, ShieldCheck, Stethoscope } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { blogPosts } from '../data/demoData';
import { useI18n } from '../context/I18nContext';

export function Blog() {
  const { t } = useI18n();
  const categories = [
    t('publicPages.blog.categories.one'),
    t('publicPages.blog.categories.two'),
    t('publicPages.blog.categories.three'),
    t('publicPages.blog.categories.four'),
  ];

  const readTimes = ['5 min read', '7 min read', '6 min read'];

  return (
    <div>
      <PageHeader
        eyebrow={t('publicPages.blog.header.eyebrow')}
        title={t('publicPages.blog.header.title')}
        description={t('publicPages.blog.header.description')}
        action={(
          <Button as={Link} to="/login/doctor" variant="secondary" size="lg">
            {t('publicPages.blog.header.cta')} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <div key={category} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
            {category}
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {blogPosts.map((post, index) => (
          <Card key={post.id} className="overflow-hidden p-0">
            <div className="aspect-[16/10] overflow-hidden">
              <img src={post.image} alt={post.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
            </div>
            <div className="space-y-3 p-6">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em]">
                <span className="text-cyan-300">{t('publicPages.blog.article')}</span>
                <span className="inline-flex items-center gap-1 text-slate-300"><Clock3 className="h-3.5 w-3.5" /> {readTimes[index] || '6 min read'}</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">{post.title}</h3>
              <p className="text-sm leading-7 text-slate-300">{post.description}</p>
              <div className="flex items-center gap-3 pt-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-cyan-200" /> {t('publicPages.blog.clinical')}</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-200" /> {t('publicPages.blog.trusted')}</span>
              </div>
              <Button as={Link} to="/contact" variant="secondary" size="sm" className="mt-2">
                {t('publicPages.blog.discuss')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
