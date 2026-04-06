import { Instagram, Send } from "lucide-react";
import { IconBrandTiktok } from "@tabler/icons-react";

const Footer = () => {
  const socialLinks = [
    {
      name: "Instagram",
      icon: Instagram,
  url: "https://instagram.com/dynasty.spb",
      color: "hover:text-pink-500"
    },
    {
      name: "Telegram",
      icon: Send,
  url: "https://t.me/dynastyspbshop",
      color: "hover:text-blue-500"
    },
    {
      name: "TikTok",
      icon: IconBrandTiktok,
      url: "https://tiktok.com/@dynasty.spb",
      color: "hover:text-gray-200"
    }
  ];

  return (
    <footer id="contacts" className="py-16 px-4 sm:px-6 lg:px-8 bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
            <span style={{ fontFamily: 'Eagle Lake, cursive' }}>Dynasty</span>
          </h2>
          <p className="text-xs sm:text-base text-gray-300 mb-6">
            Следи за нами в социальных сетях
          </p>
          
          <div className="flex justify-center space-x-6">
            {socialLinks.map((social) => {
              const IconComponent = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-white transition-colors duration-300 ${social.color}`}
                >
                  <IconComponent size={32} />
                  <span className="sr-only">{social.name}</span>
                </a>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-8 pt-6 border-t border-gray-800">
          <p className="text-xs sm:text-base text-gray-400">
            © 2025 Dynasty Brand. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;