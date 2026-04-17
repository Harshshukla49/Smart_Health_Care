# CSS & Code Snippets - Copy & Paste Ready

## Quick Copy-Paste Examples

### 1. Dashboard Header with Gradient
```jsx
<div className="space-y-6">
  {/* Main Header */}
  <div className="glass p-8 rounded-2xl border border-white/10">
    <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
      Smart Healthcare
    </p>
    <h1 className="gradient-text mt-4 text-5xl">
      Patient Monitoring Dashboard
    </h1>
    <p className="text-slate-300 mt-4 max-w-2xl">
      Real-time vitals monitoring, health insights, and predictive analytics.
      All in one beautiful, responsive interface.
    </p>
  </div>

  {/* KPI Cards Row */}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard icon={Users} label="Patients" value="24" tone="blue" />
    <MetricCard icon={Activity} label="Active" value="18" delta="+3" tone="green" />
    <MetricCard icon={AlertCircle} label="Alerts" value="2" delta="-1" tone="red" />
    <MetricCard icon={TrendingUp} label="Uptime" value="99.8%" tone="cyan" />
  </div>
</div>
```

---

### 2. Vitals Grid with All Card Types
```jsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {/* Heart Rate - Blue/Indigo */}
  <VitalCard
    label="Heart Rate"
    value={72}
    unit="bpm"
    icon={<HeartPulse className="h-5 w-5" />}
    vitalType="heart"
    accent="text-blue-400"
    updatedAt="2 seconds ago"
  />

  {/* SpO2 - Teal/Green */}
  <VitalCard
    label="Blood Oxygen"
    value={98}
    unit="%"
    icon={<Waves className="h-5 w-5" />}
    vitalType="spo2"
    accent="text-teal-400"
    updatedAt="2 seconds ago"
  />

  {/* Temperature - Orange/Red */}
  <VitalCard
    label="Temperature"
    value={36.8}
    unit="°C"
    icon={<Thermometer className="h-5 w-5" />}
    vitalType="temperature"
    accent="text-orange-400"
    updatedAt="5 seconds ago"
  />

  {/* ECG - Purple/Pink */}
  <VitalCard
    label="ECG Status"
    value="Normal"
    unit="✓"
    icon={<Activity className="h-5 w-5" />}
    vitalType="ecg"
    accent="text-purple-400"
    updatedAt="1 second ago"
  />
</div>
```

---

### 3. Alert Banner - Critical Value
```jsx
{isCritical && (
  <Alert
    type="danger"
    title="⚠️ Critical Alert"
    message="Patient SpO2 level has dropped below 90%. Immediate medical attention required."
    dismissible={true}
  />
)}

{/* Or direct CSS version */}
<div className="alert alert-danger">
  <AlertCircle size={20} />
  <div className="alert-content">
    <p className="font-semibold">Critical Alert</p>
    <p className="text-sm">SpO2 level critically low</p>
  </div>
  <button className="alert-close">×</button>
</div>
```

---

### 4. Chart Container with Glass
```jsx
<Card className="p-6">
  <div className="flex items-center justify-between gap-3 mb-6">
    <div>
      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Vitals</p>
      <h3 className="font-display text-2xl font-bold text-white mt-2">
        Trend Analysis
      </h3>
    </div>
    <TrendingUp className="text-teal-400 h-6 w-6" />
  </div>
  
  {/* Your chart component here */}
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={vitalsData}>
      <CartesianGrid stroke="rgba(255,255,255,0.1)" />
      <XAxis stroke="rgba(255,255,255,0.3)" />
      <YAxis stroke="rgba(255,255,255,0.3)" />
      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }} />
      <Legend />
      <Line type="monotone" dataKey="heartRate" stroke="#3b82f6" />
      <Line type="monotone" dataKey="spo2" stroke="#14b8a6" />
      <Line type="monotone" dataKey="temperature" stroke="#f59e0b" />
    </LineChart>
  </ResponsiveContainer>
</Card>
```

---

### 5. Action Buttons Group
```jsx
<div className="flex flex-wrap gap-3">
  {/* Primary Action */}
  <Button variant="primary" size="md">
    <Plus className="h-4 w-4" />
    Add New Patient
  </Button>

  {/* Secondary Action */}
  <Button variant="secondary" size="md">
    <Share2 className="h-4 w-4" />
    Share Report
  </Button>

  {/* Accent Action */}
  <Button variant="accent" size="md">
    <Download className="h-4 w-4" />
    Export Data
  </Button>

  {/* Ghost Button */}
  <Button variant="ghost" size="md">
    More Options
  </Button>

  {/* Danger Button */}
  <Button variant="danger" size="md">
    <Trash2 className="h-4 w-4" />
    Delete
  </Button>
</div>
```

---

### 6. Patient Info Card
```jsx
<Card className="p-6">
  <div className="flex items-center gap-4">
    {/* Avatar */}
    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
      {patientName.charAt(0)}
    </div>

    {/* Info */}
    <div className="flex-1">
      <h3 className="font-display text-xl font-bold text-white">
        {patientName}
      </h3>
      <p className="text-sm text-slate-400 mt-1">
        ID: {patientId}
      </p>
      <div className="flex gap-2 mt-2">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isCritical 
            ? 'bg-red-500/20 text-red-300 border border-red-300/50' 
            : 'bg-green-500/20 text-green-300 border border-green-300/50'
        }`}>
          {isCritical ? '🔴 Critical' : '🟢 Stable'}
        </span>
      </div>
    </div>
  </div>
</Card>
```

---

### 7. Doctor Controls List
```jsx
<Card className="p-6">
  <div className="flex items-center justify-between gap-3 mb-6">
    <div>
      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
        Patients
      </p>
      <h3 className="font-display text-2xl font-bold text-white mt-2">
        Under Supervision
      </h3>
    </div>
  </div>

  <div className="space-y-3">
    {patients.map((patient) => (
      <Link
        key={patient.id}
        to={`/patient/${patient.id}`}
        className="block p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${patient.spo2 < 90 ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <div className="flex-1">
            <p className="font-semibold text-white">{patient.name}</p>
            <p className="text-xs text-slate-400">SpO2: {patient.spo2}% • HR: {patient.heartRate} bpm</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </Link>
    ))}
  </div>
</Card>
```

---

### 8. Success/Warning Messages
```jsx
{/* Success Alert */}
<Alert
  type="success"
  title="✅ Update Successful"
  message="Patient profile has been updated successfully."
  dismissible={true}
/>

{/* Warning Alert */}
<Alert
  type="warning"
  title="⚠️ Upcoming Appointment"
  message="Patient has an appointment scheduled in 2 hours."
  dismissible={true}
/>

{/* Info Alert */}
<Alert
  type="info"
  title="ℹ️ New Data Available"
  message="Fresh vitals data received from connected wearable."
  dismissible={true}
/>
```

---

### 9. Multi-Color Status Indicators
```jsx
{/* Function to determine color */}
const getStatusColor = (value, type) => {
  if (type === 'spo2' && value < 90) return 'bg-red-500 text-red-900';
  if (type === 'spo2' && value < 95) return 'bg-yellow-500 text-yellow-900';
  if (type === 'hr' && (value > 120 || value < 60)) return 'bg-orange-500 text-orange-900';
  return 'bg-green-500 text-green-900';
};

{/* Usage */}
<div className={`inline-block px-4 py-2 rounded-full font-semibold ${getStatusColor(spo2, 'spo2')}`}>
  {spo2}% SpO2
</div>
```

---

### 10. Loading State with Glass
```jsx
<div className="glass p-8 rounded-2xl flex flex-col items-center justify-center min-h-64">
  <div className="flex gap-2 mb-4">
    <div className="h-3 w-3 rounded-full bg-blue-400 animate-bounce"></div>
    <div className="h-3 w-3 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    <div className="h-3 w-3 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
  </div>
  <p className="text-slate-300 text-lg font-semibold">Loading patient data...</p>
  <p className="text-slate-500 text-sm mt-2">Please wait</p>
</div>
```

---

### 11. Empty State
```jsx
<Card className="p-12 text-center">
  <Database className="h-16 w-16 text-slate-500 mx-auto mb-4 opacity-50" />
  <h3 className="font-display text-2xl font-bold text-white mb-2">
    No Data Available
  </h3>
  <p className="text-slate-400 mb-6">
    Patient data will appear here once connected.
  </p>
  <Button variant="primary">
    <Plus className="h-4 w-4" />
    Add Patient
  </Button>
</Card>
```

---

### 12. Dynamic Colors Based on Values
```jsx
// In JavaScript/JSX
const getVitalColor = (value, type) => {
  const thresholds = {
    heartRate: { normal: [60, 100], warning: [100, 120], critical: [120, Infinity] },
    spo2: { normal: [95, 100], warning: [90, 95], critical: [0, 90] },
    temperature: { normal: [36.5, 37.5], warning: [37.5, 38.5], critical: [38.5, 50] }
  };
  
  const t = thresholds[type];
  if (value >= t.critical[0] && value <= t.critical[1]) return 'critical';
  if (value >= t.warning[0] && value <= t.warning[1]) return 'warning';
  return 'normal';
};

{/* Usage */}
const vitalColor = getVitalColor(heartRate, 'heartRate');
<span className={`text-2xl font-bold ${
  vitalColor === 'critical' ? 'text-red-400 animate-pulse' :
  vitalColor === 'warning' ? 'text-yellow-400' :
  'text-green-400'
}`}>
  {heartRate} bpm
</span>
```

---

## Pro Tips

✨ **Combine Animations:**
```jsx
<div className="card pulse-glow hover:scale-105 transition-transform">
  Important content
</div>
```

🎨 **Custom Gradient:**
```jsx
<div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-6 rounded-xl">
  Custom gradient
</div>
```

🔔 **Pulse Animation for Alerts:**
```jsx
<div className="animate-pulse bg-red-500/20 p-4 rounded">
  Alert message
</div>
```

⚡ **Instant Feedback:**
```jsx
<button 
  onClick={() => {
    element.classList.add('slide-in');
    setTimeout(() => element.classList.remove('slide-in'), 400);
  }}
>
  Trigger Animation
</button>
```

---

✅ **All snippets are production-ready and follow best practices!**
