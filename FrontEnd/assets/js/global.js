document.addEventListener("DOMContentLoaded", requestCatergories);
document.addEventListener("DOMContentLoaded", requestBanners);
function requestCatergories() {
  fetch("http://localhost:8081/BackEnd/menu.php", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      // console.log(data);
      const nav = document.querySelector(".navigation");
      if (data.categories) {
        const ul = document.createElement("ul");
        data.categories.forEach((cat) => {
          const li = document.createElement("li");
          li.classList = cat;
          li.textContent = cat;
          li.addEventListener("click", getCategoryProducts);
          ul.appendChild(li);
        });
        nav.append(ul);
      }
    })
    .catch((error) => console.error(error));
}

function getCategoryProducts(event) {
  console.log("cate clicked");
}

function requestBanners() {
  fetch("http://localhost:8081/BackEnd/banner.php", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      if (data.banners) {
        const banners = data.banners;
        banners.forEach((banner) => {
          const slide = document.createElement("div");
          slide.className = "swiper-slide";
          slide.style.backgroundImage = `url('https://localhost:127.0.0.1:5500/FrontEnd/${banner.image}')`;
          slide.style.height = "20vh";
          const bannerSection = document.querySelector(".banner");
          bannerSection.append(slide);
        });
      }
    })
    .catch((error) => console.error(error));
}
