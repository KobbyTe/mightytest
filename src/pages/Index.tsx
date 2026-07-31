import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CoursesSection from "@/components/CoursesSection";
import StatsBar from "@/components/StatsBar";

import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Subjects from "@/components/Subjects";
import Testimonials from "@/components/Testimonials";
import FAQSection from "@/components/FAQSection";
import CTABanner from "@/components/CTABanner";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const Index = () => {
  return (
    <div className="min-h-screen">
      <SEO
        title="Mighty Test — STEM, Robotics & AI Exam Platform"
        description="Create, take, and grade STEM exams online. Mighty Test powers schools with smart assessments, instant analytics, and parent visibility."
        path="/"
      />
      <Navbar />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <Subjects />
      <Testimonials />
      <FAQSection />
      <CTABanner />
      <Footer />
    </div>
  );
};

export default Index;
