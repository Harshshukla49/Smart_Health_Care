import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { submitContactMessage } from '../services/api';

const initialState = {
  name: '',
  email: '',
  message: '',
};

export function Contact() {
  const [formData, setFormData] = useState(initialState);
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await submitContactMessage(formData);
      toast.success(result.message);
      setFormData(initialState);
    } catch (error) {
      toast.error(error.message || 'Unable to send your message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Contact Us"
        title="Talk to the team behind the remote monitoring experience."
        description="Use the form below to request a demo, ask product questions, or reach out about implementation support."
      />

      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <Card className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { label: 'Name', name: 'name', type: 'text', placeholder: 'Your full name' },
              { label: 'Email', name: 'email', type: 'email', placeholder: 'you@example.com' },
            ].map((field) => (
              <label key={field.name} className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">{field.label}</span>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:bg-white/8 focus:ring-2 focus:ring-cyan-300/20"
                />
              </label>
            ))}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-200">Message</span>
              <textarea
                name="message"
                rows="6"
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell us what you are building or what support you need."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:bg-white/8 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </Card>

        <Card className="space-y-4 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Response Channels</p>
          <h2 className="font-display text-3xl font-bold text-white">We keep communication simple and direct.</h2>
          <p className="text-sm leading-7 text-slate-300">
            This layout includes a map placeholder and contact information area so the page feels complete even before
            a production contact service is wired up.
          </p>
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-300">
            Map placeholder: insert a clinic location, office address, or embedded map here.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</p>
              <p className="mt-2 font-semibold text-white">support@smarthealth.com</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Phone</p>
              <p className="mt-2 font-semibold text-white">+1 (555) 012-4310</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
