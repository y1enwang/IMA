let corner = document.getElementById("corner");
let lady = document.getElementById("lady");
let hand = document.querySelector(".hand");
let sentence2 = document.getElementById("sentence2");

// Interaction 1:
// Hover over the dark corner to reveal the lady.
corner.addEventListener("mouseenter", function () {
  lady.style.opacity = "1";
});

// Interaction 2:
// Click the lady to make her wave and reveal the ending.
lady.addEventListener("click", function () {
  hand.classList.add("wave");
  sentence2.style.display = "block";
  document.body.classList.add("blackout");
});
