import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";

// A component to handle image loading with a fallback for different extensions
const ImageWithFallback = React.forwardRef<HTMLImageElement, { src: string; alt?: string; className?: string; style?: React.CSSProperties; onError?: () => void; loading?: "lazy" | "eager" }>((props, ref) => {
  const { src, loading, ...otherProps } = props;
  const [imgSrc, setImgSrc] = useState(src);

  const onError = () => {
    if (imgSrc.endsWith('.jpg')) {
      setImgSrc(src.replace('.jpg', '.JPG'));
    }
  };

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  return <img ref={ref} src={imgSrc} onError={onError} loading={loading} {...otherProps} />;
});

ImageWithFallback.displayName = 'ImageWithFallback';

// A component for the magnifying glass zoom effect with a fixed aspect ratio
const ZoomableImage = ({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current && !isMobile) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePos({ x, y });
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) setIsHovering(true);
  };
  
  const handleMouseLeave = () => {
    if (!isMobile) setIsHovering(false);
  };

  const handleClick = () => {
    if (isMobile && onClick) {
      onClick();
    }
  };

  return (
    // This outer div creates a stable 1:1 aspect ratio box
    <div 
      ref={containerRef}
      className={`relative w-full ${!isMobile ? 'cursor-zoom-in' : 'cursor-pointer'}`}
      style={{ paddingTop: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* This inner div contains the image and clips the zoom */}
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <ImageWithFallback
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 ease-out"
          style={{
            transform: isHovering && !isMobile ? 'scale(2.5)' : 'scale(1)',
            transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
          }}
        />
      </div>
    </div>
  );
};

// Полноэкранный компонент с зумом пинчем
const FullscreenImageViewer = ({ src, alt, isOpen, onClose }: { src: string; alt: string; isOpen: boolean; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const newScale = scale * (distance / lastTouchDistance);
        setScale(Math.max(1, Math.min(4, newScale)));
      }
      setLastTouchDistance(distance);
    }
  };

  const resetImage = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (isOpen) {
      resetImage();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', touchAction: 'none' }}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-xl z-10 p-4"
        style={{ minWidth: '44px', minHeight: '44px' }}
      >
        ✕
      </button>
      <div
        className="w-full h-full flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'none' }}
      >
        <ImageWithFallback
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transition: 'transform 0.1s ease-out',
            willChange: 'transform',
          }}
        />
      </div>
    </div>
  );
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // Сохраняем позицию скролла при открытии карточки
  useEffect(() => {
    const scrollY = window.scrollY;
    sessionStorage.setItem('catalogScrollY', String(scrollY));
  }, []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showSizeWarning, setShowSizeWarning] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // Product data is now only for text. Images are loaded by convention.
  const products = {
    "black-hoodie": {
      id: "black-hoodie",
      title: "Dynasty Legacy Hoodie Black",
      description: "Премиальное худи из высококачественного хлопка. Символ успеха и стиля.",
      fullDescription: "Это худи создано для тех, кто понимает ценность качества и стиля. Изготовлено из премиального 100% хлопка с добавлением эластана для идеальной посадки. Минималистичный дизайн с фирменным логотипом Dynasty подчеркнет ваш статус и чувство стиля.",
      price: "7890₽",
      originalPrice: undefined,
      category: "Худи",
      sizes: ["S", "M", "L", "XL"],
      features: [
        "100% премиальный хлопок",
        "Фирменная вышивка Dynasty",
        "Усиленные швы",
        "Комфортная посадка",
        "Устойчивость к стирке"
      ]
    },
    "white-hoodie": {
      id: "white-hoodie",
      title: "Dynasty Legacy Hoodie Grey",
      description: "Элегантное серое худи для тех, кто не боится выделяться.",
      fullDescription: "Белый цвет — символ чистоты намерений и уверенности в себе. Это худи станет основой вашего гардероба и подчеркнет вашу индивидуальность.",
      price: "7890₽",
      originalPrice: undefined,
      category: "Худи",
      sizes: ["S", "M", "L", "XL"],
      features: [
        "100% премиальный хлопок",
        "Фирменная вышивка Dynasty",
        "Усиленные швы",
        "Комфортная посадка",
        "Устойчивость к стирке"
      ]
    },
    "black-pants": {
      id: "black-pants",
      title: "Dynasty Legacy Pants Black",
      description: "Стильные штаны, которые дополнят образ успешного человека.",
      fullDescription: "Эти штаны сочетают в себе комфорт спортивной одежды и элегантность streetwear. Идеально подходят как для повседневной носки, так и для особых случаев.",
      price: "6490₽",
      originalPrice: undefined,
      category: "Штаны",
      sizes: ["S", "M", "L", "XL"],
      features: [
        "Премиальный трикотаж",
        "Эластичный пояс",
        "Боковые карманы",
        "Зауженный крой",
        "Логотип Dynasty"
      ]
    },
    "white-pants": {
      id: "white-pants",
      title: "Dynasty Legacy Pants Grey",
      description: "Комфорт и элегантность в каждой детали. Создано для побед.",
      fullDescription: "Белые штаны Dynasty — это воплощение современного минимализма и функциональности. Созданы для активной жизни успешных людей.",
      price: "6490₽",
      originalPrice: undefined,
      category: "Штаны",
      sizes: ["S", "M", "L", "XL"],
      features: [
        "Премиальный трикотаж",
        "Эластичный пояс",
        "Боковые карманы",
        "Зауженный крой",
        "Логотип Dynasty"
      ]
    },
    "black-set": {
      id: "black-set",
      title: "Dynasty Legacy Set Black",
      description: "Полный черный комплект: худи + штаны. Скидка 15% при покупке сета.",
      fullDescription: "Комплект Dynasty Legacy Black — худи и штаны, созданные для максимального комфорта и стиля. Скидка 15% при покупке сета.",
      price: "12890₽",
      originalPrice: "14380₽",
      category: "Комплект",
      sizes: ["S", "M", "L", "XL"],
      features: [
        "Премиальный хлопок и трикотаж",
        "Фирменная вышивка Dynasty",
        "Усиленные швы",
        "Эластичный пояс",
        "Скидка 15% при покупке сета"
      ]
    },
    "grey-set": {
      id: "grey-set",
      title: "Dynasty Legacy Set Grey",
      description: "Полный серый комплект: худи + штаны. Скидка 15% при покупке сета.",
      fullDescription: "Комплект Dynasty Legacy Grey — худи и штаны, созданные для максимального комфорта и стиля. Скидка 15% при покупке сета.",
      price: "12890₽",
      originalPrice: "14380₽",
      category: "Комплект",
      sizes: ["S", "M", "L", "XL"],
      features: [
        "Премиальный хлопок и трикотаж",
        "Фирменная вышивка Dynasty",
        "Усиленные швы",
        "Эластичный пояс",
        "Скидка 15% при покупке сета"
      ]
    }
  };

  const product = products[id as keyof typeof products];

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Товар не найден</h1>
          <Button onClick={() => {
            navigate('/');
            setTimeout(() => {
              const y = Number(sessionStorage.getItem('catalogScrollY') || '0');
              window.scrollTo({ top: y, behavior: 'auto' });
            }, 0);
          }} variant="dynasty">
            Вернуться на главную
          </Button>
        </div>
      </div>
    );
  }

  // Dynamically generate image URLs based on product ID and file naming convention
  const imageUrls = [
    {
      webp: `/images/products/${product.id}/slide1.webp`,
      jpg: `/images/products/${product.id}/slide1.jpg`
    },
    {
      webp: `/images/products/${product.id}/slide2.webp`,
      jpg: `/images/products/${product.id}/slide2.jpg`
    }
  ];

  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imageUrls.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + imageUrls.length) % imageUrls.length);
  };

  // Обработчики для свайпа
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextImage();
    }
    if (isRightSwipe) {
      prevImage();
    }
  };

  const openFullscreen = () => {
    setIsFullscreenOpen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreenOpen(false);
  };

  const handleOrder = () => {
    // Формируем deep link по инструкции
    if (!selectedSize) {
      setShowSizeWarning(true);
      return;
    }
    let startParam = product.id + `_${selectedSize}`;
    window.open(`https://t.me/dynasty_site_bot?start=${startParam}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Модальное окно предупреждения о выборе размера */}
      {showSizeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" style={{ touchAction: 'none' }}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center relative">
            <h2 className="text-xl font-bold mb-4 text-black">Пожалуйста, выберите размер</h2>
            <p className="mb-6 text-black">Для оформления предзаказа необходимо выбрать размер товара.</p>
            <button
              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
              onClick={() => setShowSizeWarning(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Полноэкранный просмотр изображения */}
      <FullscreenImageViewer
          src={imageUrls[currentImageIndex].jpg}
        alt={`${product.title} - ${currentImageIndex + 1}`}
        isOpen={isFullscreenOpen}
        onClose={closeFullscreen}
      />
      <div className="relative px-4 sm:px-6 lg:px-8 py-12">
        <Button
          variant="ghost"
          onClick={() => {
            navigate('/');
            setTimeout(() => {
              const y = Number(sessionStorage.getItem('catalogScrollY') || '0');
              window.scrollTo({ top: y, behavior: 'auto' });
            }, 0);
          }}
          className="absolute top-4 right-2 p-2 text-black opacity-70 hover:opacity-100 hover:bg-transparent z-20"
          style={{ minWidth: '44px', minHeight: '44px' }}
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="black"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: '32px', height: '32px' }}
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </Button>
        {/* Back button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-8 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={20} className="mr-2" />
          Назад к каталогу
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image Slider */}
          <div 
            className="relative group"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <picture>
              <source srcSet={imageUrls[currentImageIndex].webp} type="image/webp" />
              <ZoomableImage
                src={imageUrls[currentImageIndex].jpg}
                alt={`${product.title} - ${currentImageIndex + 1}`}
                onClick={openFullscreen}
                loading="lazy"
              />
            </picture>
            <Button 
              variant="ghost"
              size="icon"
              onClick={prevImage}
              className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/20 text-white hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft />
            </Button>
            <Button 
              variant="ghost"
              size="icon"
              onClick={nextImage}
              className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/20 text-white hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight />
            </Button>
          </div>

          {/* Product Info */}
          <div className="space-y-6 text-gray-800">
            <div>
              <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-semibold">
                {product.category}
              </span>
              <h1 className="text-4xl font-display font-bold mt-4 text-black">
                {product.title}
              </h1>
              <p className="text-xl text-muted-foreground mt-2">
                {product.description}
              </p>
            </div>

            <div className="text-3xl font-bold text-black">
              {product.originalPrice ? (
                <span className="text-2xl text-black/60 line-through mr-4">{product.originalPrice}</span>
              ) : null}
              <span className="text-3xl font-bold text-black">{product.price}</span>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3">Описание</h3>
              <p className="text-black leading-relaxed">
                {product.fullDescription}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3">Размеры</h3>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((size) => (
                  <span 
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`border border-border px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer select-none
                      ${selectedSize === size ? 'bg-black text-white border-black font-bold' : 'hover:border-accent'}`}
                  >
                    {size}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3">Особенности</h3>
              <ul className="space-y-2">
                {product.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-black">
                    <span className="w-2 h-2 bg-accent rounded-full mr-3"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-4 pt-6">
              <Button 
                variant="dynasty" 
                size="lg" 
                className="flex-1 text-lg"
                onClick={handleOrder}
              >
                <ShoppingCart size={20} className="mr-2" />
                Предзаказ в Telegram
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;