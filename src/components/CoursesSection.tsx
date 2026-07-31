import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Clock, Layers, Star, ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORIES = ["UI/UX Design", "Development", "Data Science", "Business", "Financial"];

type Course = {
  id: number;
  title: string;
  instructor: string;
  tag: string;
  image: string;
  duration: string;
  lectures: string;
  price: string;
  oldPrice?: string;
  rating: string;
};

const COURSES: Course[] = [
  {
    id: 1,
    title: "Data Science and Machine Learning with Python - Hands On!",
    instructor: "Jason Williams",
    tag: "Science",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=640&q=60",
    duration: "08 hr 15 mins",
    lectures: "29 Lectures",
    price: "$385.00",
    oldPrice: "$440.00",
    rating: "4.9",
  },
  {
    id: 2,
    title: "Create Amazing Color Schemes for Your UX Design Projects",
    instructor: "Pamela Foster",
    tag: "Design",
    image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=640&q=60",
    duration: "08 hr 15 mins",
    lectures: "29 Lectures",
    price: "$420.00",
    rating: "4.9",
  },
  {
    id: 3,
    title: "Culture & Leadership: Strategies for a Successful Business",
    instructor: "Rose Simmons",
    tag: "Business",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&q=60",
    duration: "08 hr 15 mins",
    lectures: "29 Lectures",
    price: "$295.00",
    oldPrice: "$340.00",
    rating: "4.9",
  },
  {
    id: 4,
    title: "Finance Series: Learn to Budget and Calculate Your Net Worth",
    instructor: "Jason Williams",
    tag: "Finance",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=640&q=60",
    duration: "08 hr 15 mins",
    lectures: "29 Lectures",
    price: "Free",
    rating: "4.9",
  },
  {
    id: 5,
    title: "Build Brand Into Marketing: Tackling the New Marketing Landscape",
    instructor: "Jason Williams",
    tag: "Marketing",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=640&q=60",
    duration: "08 hr 15 mins",
    lectures: "29 Lectures",
    price: "$136.00",
    rating: "4.9",
  },
  {
    id: 6,
    title: "Graphic Design: Illustrating Badges and Icons with Geometric Shapes",
    instructor: "Jason Williams",
    tag: "Design",
    image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=640&q=60",
    duration: "08 hr 15 mins",
    lectures: "29 Lectures",
    price: "$237.00",
    rating: "4.9",
  },
];

const CoursesSection = () => {
  const [active, setActive] = useState(CATEGORIES[0]);
  const [query, setQuery] = useState("");

  const visible = COURSES.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <section id="courses" className="bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        {/* Heading + search */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="text-3xl font-bold text-brand-darkest md:text-4xl">
            All{" "}
            <span className="relative text-brand">
              Courses
              <svg
                viewBox="0 0 120 10"
                aria-hidden="true"
                preserveAspectRatio="none"
                className="absolute -bottom-1 left-0 w-full text-brand-soft"
              >
                <path d="M2 7C35 2 85 2 118 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>{" "}
            of Edule
          </h2>

          <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your course"
              aria-label="Search your course"
              className="h-9 flex-1 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
            />
            <Button size="icon" className="h-9 w-9 shrink-0 rounded-full bg-brand text-primary-foreground">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="mb-10 flex items-center gap-3 rounded-3xl bg-brand-light/50 p-3">
          <button
            aria-label="Previous categories"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-soft text-brand-muted sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`whitespace-nowrap rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                  active === cat
                    ? "border-brand bg-card text-brand"
                    : "border-brand-soft/60 bg-card/70 text-brand-muted hover:border-brand-soft"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            aria-label="Next categories"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-soft text-brand-muted sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <article
              key={course.id}
              className="overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-card transition-transform duration-300 hover:-translate-y-1"
            >
              <img
                src={course.image}
                alt={course.title}
                loading="lazy"
                width={640}
                height={360}
                className="h-44 w-full rounded-2xl object-cover"
              />

              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light text-[11px] font-bold text-brand">
                      {course.instructor.charAt(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">{course.instructor}</span>
                  </div>
                  <span className="rounded-full bg-brand-light px-3 py-1 text-[11px] font-medium text-brand">
                    {course.tag}
                  </span>
                </div>

                <h3 className="line-clamp-2 text-sm font-bold leading-snug text-brand-darkest">
                  {course.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-brand-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {course.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> {course.lectures}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-brand-light/60 px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-brand">{course.price}</span>
                    {course.oldPrice && (
                      <span className="text-xs text-muted-foreground line-through">{course.oldPrice}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-brand-darkest">
                    {course.rating}
                    <Star className="h-3.5 w-3.5 fill-brand-muted text-brand-muted" />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link to="/auth">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-2 border-brand bg-transparent px-8 text-brand hover:bg-brand-light"
            >
              Other Course
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CoursesSection;
