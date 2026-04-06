const About = () => {
  return (
    <section 
      id="about" 
      className="relative py-20 px-4 sm:px-6 lg:px-8 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/Margraf.jpg')` }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-6">
              <span className="gradient-text">О БРЕНДЕ</span>
            </h2>
            
            <div className="max-w-3xl mx-auto font-serif text-foreground/90">
              <h3 className="text-xl sm:text-2xl font-bold gradient-text mb-4">
                ИДЕОЛОГИЯ DYNASTY
              </h3>
              
              <div className="space-y-4 text-xs sm:text-base leading-relaxed text-center">
                <p>
                  <span className="gradient-text font-bold">Dynasty</span> — это про энергию успеха. 
                </p>
                <p>
                  Каждая вещь Dynasty несёт в себе код успеха. Это не просто одежда — 
                  это манифест твоих амбиций, символ твоего стремления к вершине.
                </p>
              </div>
            </div>
          </div>
        </div>
    </section>
  );
};

export default About;