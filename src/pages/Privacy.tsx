import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const Privacy = () => {
  return (
    <div className="min-h-screen">
      <SEO
        title="Privacy Policy — Mighty Test"
        description="How Mighty Test collects, uses, and protects student, parent, and teacher data."
        path="/privacy"
      />
      <Navbar />
      <main className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl prose prose-neutral">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-6">Last updated: March 2026</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">1. Information We Collect</h2>
          <p className="text-muted-foreground mb-4">We collect information you provide when registering: name, email, date of birth, school information, and parent/guardian details. We also collect exam responses, scores, and usage analytics.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">2. How We Use Your Information</h2>
          <p className="text-muted-foreground mb-4">Your information is used to: provide the assessment platform, generate performance reports, communicate results to parents and teachers, and improve our services.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">3. Data Protection</h2>
          <p className="text-muted-foreground mb-4">We implement industry-standard security measures including encryption, role-based access control, and row-level security policies. Student data is only accessible to authorized users (the student, their parent, and school administrators).</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">4. Data Sharing</h2>
          <p className="text-muted-foreground mb-4">We do not sell or share your personal information with third parties. Data is only shared within the platform's role-based hierarchy (student → parent → school admin).</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">5. Children's Privacy</h2>
          <p className="text-muted-foreground mb-4">Mighty Test is designed for use by students of all ages under school supervision. Student accounts are created through school-administered registration keys, ensuring appropriate oversight.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">6. Your Rights</h2>
          <p className="text-muted-foreground mb-4">You have the right to access, correct, or request deletion of your personal data. Contact your school administrator or reach out to us directly.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">7. Cookies & Analytics</h2>
          <p className="text-muted-foreground mb-4">We use session-based tracking for analytics purposes to improve the platform. No third-party tracking cookies are used.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">8. Contact</h2>
          <p className="text-muted-foreground mb-4">For privacy-related inquiries, contact us at kwabenatekyi19@gmail.com.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
