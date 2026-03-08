import { useState, useEffect } from "react";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const testimonials = [
  {
    quote: "Mighty Test transformed how our students approach STEM exams. The instant feedback and analytics help us identify gaps quickly.",
    name: "Mrs. Adwoa Mensah",
    role: "Head Teacher, Accra STEM Academy",
    avatar: "👩‍🏫",
  },
  {
    quote: "As a parent, I love being able to track my child's progress in real-time. The detailed reports give me peace of mind.",
    name: "Mr. Kwame Asante",
    role: "Parent",
    avatar: "👨‍💼",
  },
  {
    quote: "Taking exams on Mighty Test is actually fun! I can see where I went wrong and learn from my mistakes right away.",
    name: "Ama Serwaa",
    role: "Student, Grade 9",
    avatar: "👩‍🎓",
  },
  {
    quote: "The platform saves us hours of manual grading. We can now focus on teaching rather than paperwork.",
    name: "Mr. Emmanuel Osei",
    role: "Science Teacher",
    avatar: "👨‍🔬",
  },
];

const Testimonials = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  return (
    <section className="py-20 bg-muted">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
            What People Are Saying
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Trusted by schools, parents, and students across the country.
          </p>
        </div>

        <div className="max-w-2xl mx-auto relative">
          <div className="bg-card rounded-2xl p-8 md:p-10 shadow-lg border border-border relative overflow-hidden">
            <Quote className="absolute top-6 left-6 w-10 h-10 text-primary/20" />
            <div className="relative z-10 text-center space-y-6">
              <p className="text-lg md:text-xl text-foreground/90 italic leading-relaxed">
                "{testimonials[current].quote}"
              </p>
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl">{testimonials[current].avatar}</span>
                <p className="font-heading font-bold text-foreground">{testimonials[current].name}</p>
                <p className="text-sm text-muted-foreground">{testimonials[current].role}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <Button variant="outline" size="icon" onClick={prev} className="rounded-full">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === current ? "bg-primary w-6" : "bg-border"
                  }`}
                />
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={next} className="rounded-full">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
