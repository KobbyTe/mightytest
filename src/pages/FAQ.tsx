import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "What is Mighty Test?", a: "Mighty Test is a comprehensive STEM assessment platform that allows schools to create, assign, and grade exams online. Students take exams digitally and receive instant feedback and performance analytics." },
  { q: "How do students register?", a: "Students register using a unique registration key provided by their school administrator. The key links them to their school and class automatically." },
  { q: "Can parents track their child's progress?", a: "Yes! Each student can have a linked parent account that provides real-time access to exam scores, performance trends, and detailed report cards." },
  { q: "What subjects are supported?", a: "Mighty Test supports all STEM subjects including Science, Technology, Engineering, Mathematics, Robotics, and Artificial Intelligence. Custom subjects can also be created by administrators." },
  { q: "Is there a cost to use Mighty Test?", a: "Mighty Test is currently free to use for all schools and students. We're focused on building the best STEM assessment platform." },
  { q: "How secure is student data?", a: "We take data security very seriously. All data is encrypted, access is role-based with row-level security, and we follow industry best practices." },
  { q: "How are exams graded?", a: "Multiple choice questions are auto-graded instantly. Open-ended and subjective questions can be manually graded by teachers with a built-in grading interface." },
  { q: "Can students retake exams?", a: "Yes, administrators can open resit windows for specific exams and classes. Students can request resits which are reviewed by the admin." },
  { q: "Does the platform support multiple schools?", a: "Yes! Mighty Test is designed for multi-school management. Each school has its own classes, students, and exam assignments." },
  { q: "How do I get started as a school?", a: "Contact us to set up your school on the platform. We'll create your admin account and help you generate registration keys for your students." },
  { q: "Is there a mobile app?", a: "Mighty Test is a fully responsive web application that works on phones, tablets, and desktops. No app download is needed." },
  { q: "Can I export student reports?", a: "Yes, administrators can export individual report cards and class performance reports as PDF or CSV files." },
];

const FAQ = () => {
  return (
    <div className="min-h-screen">
      <SEO
        title="FAQ — Mighty Test Questions Answered"
        description="Answers to common questions about Mighty Test registration, grading, resits, parent access, and data security."
        path="/faq"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <Navbar />
      <main>
        <section className="py-20 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Everything you need to know about Mighty Test.
            </p>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-2xl">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="bg-card border border-border rounded-xl px-6 shadow-sm"
                >
                  <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:text-primary">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;
