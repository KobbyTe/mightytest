import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl prose prose-neutral">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-6">Last updated: March 2026</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground mb-4">By accessing and using Mighty Test, you accept and agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">2. Description of Service</h2>
          <p className="text-muted-foreground mb-4">Mighty Test provides a web-based STEM assessment platform for schools, students, and parents. Features include exam creation, digital test-taking, automated and manual grading, performance analytics, and communication tools.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">3. User Accounts</h2>
          <p className="text-muted-foreground mb-4">Users must provide accurate information when creating accounts. You are responsible for maintaining the confidentiality of your login credentials. Registration keys are provided by school administrators and should not be shared publicly.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">4. Acceptable Use</h2>
          <p className="text-muted-foreground mb-4">You agree not to misuse the platform, including but not limited to: sharing exam answers, attempting to access other users' accounts, or using the platform for unauthorized purposes.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">5. Intellectual Property</h2>
          <p className="text-muted-foreground mb-4">All content, design, and functionality on Mighty Test is owned by the platform. Exam content created by administrators remains their intellectual property.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">6. Limitation of Liability</h2>
          <p className="text-muted-foreground mb-4">Mighty Test is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use or inability to use the platform.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">7. Changes to Terms</h2>
          <p className="text-muted-foreground mb-4">We reserve the right to modify these terms at any time. Continued use of the platform constitutes acceptance of updated terms.</p>

          <h2 className="text-xl font-heading font-bold text-foreground mt-8 mb-3">8. Contact</h2>
          <p className="text-muted-foreground mb-4">For questions about these terms, please contact us at kwabenatekyi19@gmail.com.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
