
// Cabinet of Curiosities


const searchAPI =
  "https://collectionapi.metmuseum.org/public/collection/v1.1/search";

const objectAPI =
  "https://collectionapi.metmuseum.org/public/collection/v1/objects/";


// Finding the HTML elements 

const choiceButtons = document.querySelectorAll(".choice");

const mysteryBox = document.querySelector("#mysteryBox");

const selectedWordText = document.querySelector("#selectedWord");

const statusText = document.querySelector("#status");

const result = document.querySelector("#result");

const artworkImage = document.querySelector("#artworkImage");

const artworkTitle = document.querySelector("#artworkTitle");

const artworkDate = document.querySelector("#artworkDate");

const artworkMedium = document.querySelector("#artworkMedium");

const artworkLink = document.querySelector("#artworkLink");


// This variable remembers the user's choice.

let selectedWord = "";


// STEP 1
// Choosing one category

choiceButtons.forEach(function(button) {

  button.addEventListener("click", function() {

    // Remove the black selected style from all buttons.
    choiceButtons.forEach(function(otherButton) {
      otherButton.classList.remove("selected");
    });

    // Make the clicked button black.
    button.classList.add("selected");

    // Get the hidden data-word from the HTML button.
    selectedWord = button.dataset.word;

    // Show the selected word on the page.
    selectedWordText.textContent =
      "Selected: " + selectedWord;
  });

});

// STEP 2
// Opening the mystery box

mysteryBox.addEventListener("click", function() {

  // Do not search if the user has not chosen anything.
  if (selectedWord === "") {
    statusText.textContent =
      "Please choose a curiosity first.";

    return;
  }

  getArtwork();

});



// STEP 3
// Search The Met using fetch().

async function getArtwork() {

  statusText.textContent = "Searching The Met...";

  result.style.display = "none";

  // Build the search URL.
  const searchURL =
    searchAPI +
    "?hasImages=true&q=" +
    selectedWord;

  try {

    // FIRST FETCH:
    // Ask The Met for artwork IDs.

    const response = await fetch(searchURL);

    const data = await response.json();

    console.log("Search data:", data);


    // Check if the search found anything.

    if (!data.objectIDs || data.objectIDs.length === 0) {
      statusText.textContent =
        "No artwork found. Try another word.";

      return;
    }


    // Pick one random artwork ID.

    const randomNumber =
      Math.floor(Math.random() * data.objectIDs.length);

    const randomID =
      data.objectIDs[randomNumber];


    // SECOND FETCH:
    // Ask The Met for information about that artwork.

    const artworkResponse =
      await fetch(objectAPI + randomID);

    const artwork =
      await artworkResponse.json();

    console.log("Artwork data:", artwork);


    // try again.

    if (!artwork.primaryImageSmall) {
      getArtwork();
      return;
    }

    // STEP 4
    // JSON DATA


    artworkImage.src =
      artwork.primaryImageSmall;

    artworkTitle.textContent =
      artwork.title || "Untitled";

    artworkDate.textContent =
      "Date: " +
      (artwork.objectDate || "Unknown");

    artworkMedium.textContent =
      "Medium: " +
      (artwork.medium || "Unknown");

    artworkLink.href =
      artwork.objectURL || "#";


    // Show the result.

    result.style.display = "block";

    statusText.textContent =
      "You found something!";

  }

  catch (error) {

    console.log(error);

    statusText.textContent =
      "Something went wrong. Try again.";

  }

}
