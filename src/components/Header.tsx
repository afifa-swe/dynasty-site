import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="relative w-full py-6 px-4 sm:px-6 lg:px-8">
      <nav className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center justify-center flex-1 md:justify-start md:flex-initial">
          <h1 className="text-3xl sm:text-4xl font-display font-bold gradient-text">
            <span style={{ fontFamily: 'Eagle Lake, cursive' }}>Dynasty</span>
          </h1>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#catalog" className="text-foreground hover-underline transition-colors">
            Каталог
          </a>
          <a href="#about" className="text-foreground hover-underline transition-colors">
            О бренде
          </a>
          <a href="#contacts" className="text-foreground hover-underline transition-colors">
            Контакты
          </a>
          <a href="/rating" className="text-foreground hover-underline transition-colors">
            Древо династии
          </a>
        </div>

        {/* Кнопка предзаказ удалена по запросу */}
      </nav>
    </header>
  );
};

export default Header;