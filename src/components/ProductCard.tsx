import { useNavigate } from "react-router-dom";

interface ProductCardProps {
  image: string;
  title: string;
  description: string;
  price: string;
  originalPrice?: string;
  productId?: string;
  isSet?: boolean;
}

const ProductCard = ({ image, title, description, price, originalPrice, productId, isSet }: ProductCardProps) => {
  const navigate = useNavigate();


  const handleProductClick = () => {
    if (productId && !isSet) {
      navigate(`/product/${productId}`);
    }
  };

  return (
    <div 
      className={`dynasty-card group relative flex flex-col min-h-[320px] sm:min-h-[420px] ${!isSet ? 'cursor-pointer' : ''} p-3 sm:p-4`}
      onClick={handleProductClick}
    >
      <div className="relative overflow-hidden rounded-lg mb-2 sm:mb-4">
        {/* 1:1 Aspect Ratio Box */}
        <div style={{ paddingTop: '100%' }} />
        <img 
          src={image} 
          alt={title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex-1">
          <h3 className="text-base sm:text-xl font-display font-bold text-black transition-all duration-300 leading-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-base text-black leading-normal mb-3 sm:mb-6">
            {description}
          </p>
        </div>
        <div className="mt-auto sm:absolute sm:left-0 sm:bottom-0 sm:w-full sm:px-3 sm:pb-3">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 sm:gap-0">
            <div>
              {originalPrice ? (
                <span className="text-sm sm:text-base text-black/60 line-through mr-2">
                  {originalPrice}
                </span>
              ) : null}
              <span className="text-lg sm:text-2xl font-bold text-black">
                {price}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;