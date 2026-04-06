import ProductCard from "./ProductCard";
// Используем фото из public/images/products
const blackHoodie = "/images/products/black-hoodie/slide1.jpg";
const whiteHoodie = "/images/products/white-hoodie/slide1.jpg";
const blackPants = "/images/products/black-pants/slide1.jpg";
const whitePants = "/images/products/white-pants/slide1.jpg";
const blackSet = "/images/products/black-set/slide1.jpg";
const greySet = "/images/products/grey-set/slide1.jpg";

const Catalog = () => {
  const products = [
    {
      id: 1,
      productId: "black-hoodie",
      image: blackHoodie,
      title: "Dynasty Legacy Hoodie Black",
      description: "Премиальное худи из высококачественного хлопка. Символ успеха и стиля.",
      price: "7890₽"
    },
    {
      id: 2,
      productId: "white-hoodie",
      image: whiteHoodie,
      title: "Dynasty Legacy Hoodie Grey",
      description: "Элегантное серое худи для тех, кто не боится выделяться.",
      price: "7890₽"
    },
    {
      id: 3,
      productId: "black-pants",
      image: blackPants,
      title: "Dynasty Legacy Pants Black",
      description: "Стильные штаны, которые дополнят образ успешного человека.",
      price: "6490₽"
    },
    {
      id: 4,
      productId: "white-pants",
      image: whitePants,
      title: "Dynasty Legacy Pants Grey",
      description: "Комфорт и элегантность в каждой детали. Создано для побед.",
      price: "6490₽"
    },
    {
      id: 5,
      productId: "black-set",
      image: blackSet,
      title: "Dynasty Legacy Set Black",
      description: "Полный черный комплект: худи + штаны. Скидка 15% при покупке сета.",
      price: "12890₽",
      originalPrice: "14380₽"
    },
    {
      id: 6,
      productId: "grey-set",
      image: greySet,
      title: "Dynasty Legacy Set Grey",
      description: "Полный серый комплект: худи + штаны. Скидка 15% при покупке сета.",
      price: "12890₽",
      originalPrice: "14380₽"
    }
  ];

  return (
    <section id="catalog" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div>
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-display font-bold mb-6 text-black">
            КАТАЛОГ
          </h2>
          <p className="text-xl text-black max-w-2xl mx-auto">
            Одежда для тех, кто стремится к величию. Каждая вещь — это инвестиция в твой успех.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              productId={product.productId}
              image={product.image}
              title={product.title}
              description={product.description}
              price={product.price}
              originalPrice={product.originalPrice}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Catalog;