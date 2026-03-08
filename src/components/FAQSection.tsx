import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";

const faqs = [
  {
    q: "What is Mighty Test?",
    a: "Mighty Test is a comprehensive STEM assessment platform that allows schools to create, assign, and grade exams online. Students take exams digitally and receive instant feedback and performance analytics.",
  },
  {
    q: "How do students register?",
    a: "Students register using a unique registration key provided by their school administrator. The key links them to their school and class automatically.",
  },
  {
    q: "Can parents track their child's progress?",
    a: "Yes! Each student can have a linked parent account that provides real-time access to exam scores, performance trends, and detailed report cards.",
  },
  {
    q: "What subjects are supported?",
    a: "Mighty Test supports all STEM subjects including Science, Technology, Engineering, Mathematics, Robotics, and Artificial Intelligence. Custom subjects can also be created.",
  },
  {
    q: "Is there a cost to use Mighty Test?",
    a: "Mighty Test is currently free to use for all schools and students. We're focused on building the best STEM assessment platform before introducing any premium features.",
  },
  {
    q: "How secure is student data?",
    a: "We take data security very seriously. All data is encrypted, access is role-based, and we follow industry best practices for protecting student information.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Got questions? We've got answers.{" "}
            <Link to="/faq" className="text-primary hover:underline">
              See all FAQs →
            </Link>
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
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
      </div>
    </section>
  );
};

export default FAQSection;
