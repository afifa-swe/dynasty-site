import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// Используем фото из public/images/products/black-hoodie/
// Используем фото из public/images/backgrounds/MainBG1.jpg, MainBG2.jpg, MainBG3.jpg
const slides = [
  { url: "/images/backgrounds/MainBG1.jpg" },
  { url: "/images/backgrounds/MainBG2.jpg" },
  { url: "/images/backgrounds/MainBG3.jpg" }
];

const Hero = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === slides.length - 1 ? 0 : prevIndex + 1
      );
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  };

  return (
    <section className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: '100dvh' }}>
      {/* Background Slideshow */}
      {slides.map((slide, index) => (
        <div
          key={slide.url}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${slide.url})` }}
        />
      ))}
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30"></div>

      {/* Content removed by request */}
      
      {/* Slideshow Dots */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex space-x-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 ${
              currentIndex === index ? 'bg-white' : 'bg-transparent'
            } hover:bg-white`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;