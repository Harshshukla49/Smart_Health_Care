export const navigationLinks = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Blog', path: '/blog' },
  { label: 'Contact', path: '/contact' },
];

export const featureItems = [
  {
    title: 'Real-time vitals tracking',
    description: 'Monitor heart rate, SpO2, and temperature from a single responsive command center.',
    icon: 'activity',
  },
  {
    title: 'Predictive alerts',
    description: 'Send high-risk cases to the top with clear status badges and model-backed signals.',
    icon: 'shield-alert',
  },
  {
    title: 'Care team visibility',
    description: 'Give doctors and family members a shared operational view of patient well-being.',
    icon: 'users',
  },
  {
    title: 'Mobile-first workflows',
    description: 'Designed for field use, ward rounds, and fast response when every second matters.',
    icon: 'smartphone',
  },
];

export const testimonials = [
  {
    quote: 'The remote monitoring flow is clean enough for clinicians and fast enough for emergency response.',
    author: 'Dr. Aria Morgan',
    role: 'Cardiology Lead',
  },
  {
    quote: 'The dashboard makes it obvious who needs attention now, which is exactly what the ward team needs.',
    author: 'Nolan Brooks',
    role: 'Operations Manager',
  },
  {
    quote: 'Patients feel reassured because the product looks trustworthy and communicates status clearly.',
    author: 'Priya Shah',
    role: 'Care Program Director',
  },
];

export const teamMembers = [
  { name: 'Maya Chen', title: 'Product Design', bio: 'Focuses on trust, clarity, and accessible workflows for critical care.' },
  { name: 'Ethan Cole', title: 'Clinical Systems', bio: 'Connects medical signal flow with reliable backend operations.' },
  { name: 'Sara Ahmed', title: 'Frontend Engineering', bio: 'Builds the monitoring surfaces used by staff and patients.' },
];

export const blogPosts = [
  {
    id: 'blog-1',
    title: 'How remote monitoring reduces response time',
    description: 'A look at how visible vitals and alert prioritization improve triage and patient safety.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'blog-2',
    title: 'Designing for clinicians, not dashboards',
    description: 'Why the best healthcare interfaces reveal only what matters, when it matters.',
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'blog-3',
    title: 'The future of connected patient care',
    description: 'What always-on data and predictive insights mean for hospital and home monitoring.',
    image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
  },
];

export const dashboardTrends = [
  { label: 'Mon', value: 68 },
  { label: 'Tue', value: 74 },
  { label: 'Wed', value: 71 },
  { label: 'Thu', value: 79 },
  { label: 'Fri', value: 83 },
  { label: 'Sat', value: 76 },
  { label: 'Sun', value: 81 },
];

export const fallbackPatients = [
  {
    id: 'patient-001',
    name: 'Ava Johnson',
    age: 58,
    heartRate: 84,
    spo2: 97,
    temperature: 36.9,
    status: 'Normal',
    updatedAt: '2 min ago',
    notes: 'Stable overnight',
  },
  {
    id: 'patient-002',
    name: 'Liam Patel',
    age: 66,
    heartRate: 112,
    spo2: 92,
    temperature: 38.1,
    status: 'Critical',
    updatedAt: '8 min ago',
    notes: 'Needs follow-up',
  },
  {
    id: 'patient-003',
    name: 'Emma Williams',
    age: 43,
    heartRate: 78,
    spo2: 99,
    temperature: 36.4,
    status: 'Normal',
    updatedAt: '14 min ago',
    notes: 'Review tomorrow',
  },
  {
    id: 'patient-004',
    name: 'Noah Brown',
    age: 71,
    heartRate: 98,
    spo2: 94,
    temperature: 37.2,
    status: 'Warning',
    updatedAt: '20 min ago',
    notes: 'Observe closely',
  },
];
