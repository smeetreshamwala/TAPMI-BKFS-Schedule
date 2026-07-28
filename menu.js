const MENU_DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MENU_MEALS = [
  {
    key: "breakfast",
    title: "Breakfast",
    categories: [
      "Hot Preparation",
      "Side Accompaniment",
      "Egg Item",
      "Bread Counter",
      "Healthy Counter",
      "Fruit",
      "Beverage",
    ],
  },
  {
    key: "lunch",
    title: "Lunch",
    categories: [
      "Salad",
      "Beverage",
      "Dry Veg",
      "Gravy Veg",
      "Non Veg",
      "Dal",
      "Bread",
      "Rice",
      "Papad/Pickle",
    ],
  },
  {
    key: "dinner",
    title: "Dinner",
    categories: [
      "Salad",
      "Soup/Curd",
      "Dry Veg",
      "Veg Gravy",
      "Non Veg",
      "Bread",
      "Rice",
      "Dal",
      "Side Dish",
    ],
  },
];

const menuState = {
  data: null,
  selectedDay: null,
};

const menuEls = {
  defaultDay: document.getElementById("menu-default-day"),
  todayLabel: document.getElementById("menu-today-label"),
  selectedHeading: document.getElementById("menu-selected-heading"),
  dayTitle: document.getElementById("menu-day-title"),
  dayPicker: document.getElementById("menu-day-picker"),
  mealList: document.getElementById("menu-meal-list"),
};

function currentMenuDay() {
  return MENU_DAY_ORDER[(new Date().getDay() + 6) % 7];
}

function fullDayLabel(dayCode) {
  return {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  }[dayCode] || dayCode;
}

function menuValue(value) {
  return value || "—";
}

function renderMenuDayPicker() {
  menuEls.dayPicker.innerHTML = "";
  const todayCode = currentMenuDay();

  for (const dayCode of MENU_DAY_ORDER) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ghost menu-day-button${dayCode === menuState.selectedDay ? " is-active" : ""}`;
    button.textContent = fullDayLabel(dayCode);
    if (dayCode === todayCode) {
      button.setAttribute("data-today", "true");
    }
    button.addEventListener("click", () => {
      menuState.selectedDay = dayCode;
      renderMenuPage();
    });
    menuEls.dayPicker.appendChild(button);
  }
}

function buildMealCard(mealConfig) {
  const mealData = menuState.data[mealConfig.key];
  const mealCard = document.createElement("article");
  mealCard.className = "meal-card";

  const rows = mealConfig.categories
    .map((category) => {
      const value = menuValue(mealData.days[menuState.selectedDay][category]);
      return `
        <div class="meal-row">
          <span class="meal-category">${category}</span>
          <span class="meal-value">${value}</span>
        </div>
      `;
    })
    .join("");

  mealCard.innerHTML = `
    <div class="meal-card-head">
      <div>
        <p class="eyebrow">${mealConfig.title}</p>
        <h3>${mealConfig.title}</h3>
      </div>
      <span class="meal-time">${mealData.time}</span>
    </div>
    <div class="meal-rows">
      ${rows}
    </div>
  `;

  return mealCard;
}

function renderMenuMeals() {
  menuEls.mealList.innerHTML = "";
  for (const mealConfig of MENU_MEALS) {
    menuEls.mealList.appendChild(buildMealCard(mealConfig));
  }
}

function renderMenuPage() {
  const todayCode = currentMenuDay();
  menuEls.defaultDay.textContent = fullDayLabel(todayCode);
  menuEls.todayLabel.textContent = `${fullDayLabel(todayCode)} (${todayCode})`;
  menuEls.selectedHeading.textContent = `${fullDayLabel(menuState.selectedDay)} Menu`;
  menuEls.dayTitle.textContent = `${fullDayLabel(menuState.selectedDay)} meals`;
  renderMenuDayPicker();
  renderMenuMeals();
}

async function initMenuPage() {
  if (window.__MESS_MENU_DATA__) {
    menuState.data = window.__MESS_MENU_DATA__;
  } else {
    const response = await fetch("./menu.json");
    if (!response.ok) {
      throw new Error(`Could not load menu.json (${response.status})`);
    }
    menuState.data = await response.json();
  }

  menuState.selectedDay = currentMenuDay();
  renderMenuPage();
}

initMenuPage().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell">
      <section class="panel">
        <h1>Could not load mess menu</h1>
        <p class="section-note">${error.message}</p>
      </section>
    </main>
  `;
});
