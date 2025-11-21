import Navbar from "@/components/Navbar";
import { DesignShowcase } from "@/components/DesignShowcase";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <DesignShowcase />
      <Footer />
    </div>
  );
};

export default Index;
