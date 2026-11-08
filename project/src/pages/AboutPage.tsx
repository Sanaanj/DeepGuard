import {
  Shield,
  Brain,
  Eye,
  Database,
  AudioLines,
  Cpu,
  FileText,
  ScanLine,
  Layers,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function AboutPage() {
  const pipeline = [
    { icon: ScanLine, label: 'User Upload', desc: 'Drag-and-drop image or video upload' },
    { icon: FileText, label: 'File Validation', desc: 'Format and size validation' },
    { icon: Eye, label: 'Media Preprocessing', desc: 'Face detection and alignment' },
    { icon: Brain, label: 'CNN Inference', desc: 'Xception-style model prediction' },
    { icon: Layers, label: 'Visual Analysis', desc: 'Texture, lighting, blending artifacts' },
    { icon: Cpu, label: 'Temporal Analysis', desc: 'Frame-to-frame consistency (video)' },
    { icon: AudioLines, label: 'Audio Analysis', desc: 'Spectral and pitch analysis (video)' },
    { icon: Database, label: 'Evidence Fusion', desc: 'Weighted multi-source combination' },
    { icon: Eye, label: 'Explainable AI', desc: 'Grad-CAM heatmap generation' },
    { icon: FileText, label: 'Report & Storage', desc: 'PDF report and database storage' },
  ];

  const features = [
    { icon: Brain, title: 'Deep Learning Model', desc: 'Custom Xception-style CNN with depthwise separable convolutions, trained for face manipulation detection. The model analyzes aligned face regions for blending artifacts, texture inconsistencies, and frequency-domain anomalies.' },
    { icon: Eye, title: 'Explainable AI (XAI)', desc: 'Grad-CAM heatmaps show which regions of the image influenced the model\'s prediction the most. This provides transparency and helps investigators understand the AI\'s decision-making process.' },
    { icon: Cpu, title: 'Temporal Analysis', desc: 'For video inputs, the system extracts multiple frames, detects and tracks faces across frames, and analyzes frame-to-frame consistency including flicker, motion, and manipulation probability patterns.' },
    { icon: AudioLines, title: 'Audio Analysis', desc: 'For videos with audio, the system performs spectral analysis, pitch consistency checks, and noise pattern analysis to identify potential synthetic or manipulated speech.' },
    { icon: Database, title: 'Evidence Fusion', desc: 'A weighted evidence-fusion approach combines visual analysis, temporal analysis, audio analysis, forensic indicators, and CNN model prediction into a unified risk score and confidence estimate.' },
    { icon: FileText, title: 'Forensic Reports', desc: 'Professional PDF reports containing analysis ID, file information, prediction, confidence, risk score, visual analysis, temporal analysis, forensic indicators, Grad-CAM heatmap, and a clear disclaimer.' },
  ];

  const techStack = [
    { category: 'Frontend', items: ['React.js', 'TypeScript', 'Tailwind CSS', 'Recharts', 'Lucide Icons'] },
    { category: 'AI/ML', items: ['TensorFlow.js', 'BlazeFace', 'Grad-CAM', 'CNN/Xception'] },
    { category: 'Backend', items: ['Supabase', 'PostgreSQL', 'JWT Auth', 'Row-Level Security'] },
    { category: 'Analysis', items: ['OpenCV-style processing', 'LBP texture analysis', 'Spectral analysis', 'Noise estimation'] },
  ];

  const datasets = [
    { name: 'FaceForensics++', desc: 'Large-scale deepfake dataset with multiple manipulation methods', status: 'recommended' },
    { name: 'Celeb-DF (v2)', desc: 'Celebrities-based deepfake dataset with improved visual quality', status: 'recommended' },
    { name: 'DFDC', desc: 'DeepFake Detection Challenge dataset from Meta', status: 'recommended' },
    { name: 'DeeperForensics-1.0', desc: 'High-quality deepfake dataset with diverse subjects', status: 'recommended' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Hero */}
      <div className="glass-card p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Shield className="w-16 h-16 text-cyber-accent" />
            <div className="absolute inset-0 animate-ping-slow opacity-30">
              <Shield className="w-16 h-16 text-cyber-accent" />
            </div>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-cyber-text mb-3">DeepGuard</h1>
        <p className="text-lg text-cyber-accent font-mono mb-4">AI-Based Deepfake Detection & Digital Media Forensics System</p>
        <p className="text-cyber-text-dim max-w-2xl mx-auto leading-relaxed">
          A professional AI-powered platform that detects manipulated or AI-generated images and videos using
          deep learning, computer vision, and digital media forensics — with explainable AI heatmaps, evidence
          fusion scoring, and comprehensive forensic reports.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-xl font-bold text-cyber-text mb-4">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card-hover p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyber-accent/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5 text-cyber-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-cyber-text mb-1">{f.title}</h3>
                  <p className="text-sm text-cyber-text-muted leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-cyber-text mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-cyber-accent" />
          Processing Pipeline
        </h2>
        <div className="space-y-2">
          {pipeline.map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-cyber-card border border-cyber-border flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-cyber-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-cyber-text">{step.label}</p>
                  <p className="text-xs text-cyber-text-muted">{step.desc}</p>
                </div>
              </div>
              {i < pipeline.length - 1 && (
                <ArrowRight className="w-4 h-4 text-cyber-text-muted hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-cyber-text mb-4">Technology Stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {techStack.map((stack) => (
            <div key={stack.category} className="p-4 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <h3 className="text-sm font-medium text-cyber-accent mb-3">{stack.category}</h3>
              <div className="space-y-1.5">
                {stack.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-cyber-text-dim">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyber-success" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Datasets */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-cyber-text mb-4">Recommended Datasets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {datasets.map((ds) => (
            <div key={ds.name} className="flex items-start gap-3 p-4 rounded-lg bg-cyber-bg/50 border border-cyber-border">
              <Database className="w-5 h-5 text-cyber-warning flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-cyber-text">{ds.name}</h3>
                <p className="text-xs text-cyber-text-muted mt-1">{ds.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Implementation status */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-cyber-text mb-4">Implementation Status</h2>
        <div className="space-y-3">
          {[
            { label: 'CNN-based image deepfake detection', status: 'implemented' },
            { label: 'Face detection and alignment (BlazeFace)', status: 'implemented' },
            { label: 'Grad-CAM explainable AI heatmaps', status: 'implemented' },
            { label: 'Visual artifact analysis (6 indicators)', status: 'implemented' },
            { label: 'Video temporal analysis (frame consistency)', status: 'implemented' },
            { label: 'Metadata extraction and anomaly detection', status: 'implemented' },
            { label: 'Evidence fusion scoring', status: 'implemented' },
            { label: 'PDF forensic report generation', status: 'implemented' },
            { label: 'Detection history with database storage', status: 'implemented' },
            { label: 'Analytics dashboard with model comparison', status: 'implemented' },
            { label: 'Audio deepfake detection (DL model)', status: 'partial' },
            { label: 'Audio-visual synchronization analysis', status: 'partial' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              {item.status === 'implemented' ? (
                <CheckCircle2 className="w-5 h-5 text-cyber-success flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-cyber-warning flex-shrink-0" />
              )}
              <span className="text-sm text-cyber-text-dim flex-1">{item.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                item.status === 'implemented'
                  ? 'bg-cyber-success/10 text-cyber-success'
                  : 'bg-cyber-warning/10 text-cyber-warning'
              }`}>
                {item.status === 'implemented' ? 'Implemented' : 'Partial / Modular'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-cyber-warning/5 border border-cyber-warning/20">
          <p className="text-xs text-cyber-text-dim leading-relaxed">
            <strong className="text-cyber-warning">Note:</strong> Audio deepfake detection uses statistical feature
            analysis as a heuristic approach. A full deep learning model for audio deepfake detection (using datasets
            like ASVspoof) is designed as a modular component for future enhancement. Audio-visual synchronization
            uses energy-based correlation estimation.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="glass-card p-4 border-l-4 border-l-cyber-warning">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-cyber-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-cyber-text-dim">
            <strong className="text-cyber-warning">Disclaimer:</strong> AI predictions are probabilistic and should not
            be treated as conclusive proof without further investigation. The system may produce false positives or
            false negatives. Always use human judgment and additional verification methods for critical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
