import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Target, Eye, Heart, Users, Award, Globe } from "lucide-react";

const values = [
  { icon: Heart, title: "Student-First", desc: "Every feature is designed with the learner in mind." },
  { icon: Award, title: "Excellence", desc: "We hold ourselves to the highest standards in education technology." },
  { icon: Users, title: "Inclusivity", desc: "Making quality STEM assessment accessible to every school." },
  { icon: Globe, title: "Impact", desc: "Empowering the next generation of African innovators and problem-solvers." },
];

const About = () => {
  return (
    <div className="min-h-screen">
      <SEO
        title="About Mighty Test — Our Mission & Values"
        description="Learn about Mighty Test's mission to empower African STEM education through smart, accessible online assessment."
        path="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Mighty Test",
          url: "https://neuron-flow-labs.lovable.app/about",
          about: { "@type": "Organization", name: "Mighty Test" },
        }}
      />
      <Navbar />
      <main>
        {/* Hero */}
        <section className="py-20 bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-4">
              About Mighty Test
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We're on a mission to revolutionize STEM education through intelligent, accessible, and engaging assessment tools.
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 max-w-4xl">
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground mb-3">Our Mission</h2>
              <p className="text-muted-foreground">
                To provide schools with a powerful, easy-to-use platform for creating, administering, and analyzing STEM assessments — helping educators identify learning gaps and students reach their full potential.
              </p>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-accent" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground mb-3">Our Vision</h2>
              <p className="text-muted-foreground">
                A world where every student has access to quality STEM education and assessment, regardless of their school's resources or location. We envision technology bridging the gap in educational equity.
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 bg-muted">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-heading font-bold text-foreground text-center mb-10">Our Values</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {values.map((v) => (
                <div key={v.title} className="bg-card rounded-xl p-6 border border-border text-center shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <v.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-1">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
