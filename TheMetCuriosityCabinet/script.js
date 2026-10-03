
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

  mysteryBox.disabled = true;
  statusText.textContent = "Searching The Met...";

  result.style.display = "none";

  // Build the search URL.
  const searchURL =
    searchAPI +
    "?hasImages=true&q=" +
    encodeURIComponent(selectedWord);

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


    // Pick up to three different artworks with images.
    const remainingIDs = data.objectIDs.slice();
    const artworks = [];
    let attempts = 0;

    while (artworks.length < 3 && remainingIDs.length > 0 && attempts < 40) {
      attempts = attempts + 1;
      const randomNumber = Math.floor(Math.random() * remainingIDs.length);
      const randomID = remainingIDs.splice(randomNumber, 1)[0];
      try {
        const artworkResponse = await fetch(objectAPI + randomID);
        if (!artworkResponse.ok) continue;
        const artwork = await artworkResponse.json();
        if (artwork.primaryImageSmall) artworks.push(artwork);
      } catch (error) {
        console.log("Skipping an unavailable artwork", error);
      }
      statusText.textContent = "Found " + artworks.length + " of 3 discoveries...";
    }

    if (artworks.length === 0) {
      statusText.textContent = "No images available. Try another clue.";
      return;
    }

    // Keep the original variables for the first result.
    const artwork = artworks[0];
    artworkImage.src = artwork.primaryImageSmall;
    artworkImage.alt = artwork.title || "Artwork from The Met";
    artworkTitle.textContent = artwork.title || "Untitled";
    artworkDate.textContent = "Date: " + (artwork.objectDate || "Unknown");
    artworkMedium.textContent = "Medium: " + (artwork.medium || "Unknown");
    artworkLink.href = artwork.objectURL || "https://www.metmuseum.org/";
    artworkLink.rel = "noopener noreferrer";
    document.querySelectorAll("#firstCard .addedInfo").forEach(function(element) {
      element.remove();
    });
    addInformation(document.querySelector("#firstCard"), artwork, false);

    const moreResults = document.querySelector("#moreResults");
    moreResults.replaceChildren();
    for (let i = 1; i < artworks.length; i++) {
      moreResults.appendChild(makeCard(artworks[i], false));
    }
    result.style.display = "grid";
    statusText.textContent = artworks.length === 3
      ? "Three discoveries! Save your favorites."
      : "Found " + artworks.length + " discoveries. Try again for more.";

  }

  catch (error) {

    console.log(error);

    statusText.textContent =
      "Something went wrong. Try again.";

  }

  finally {
    mysteryBox.disabled = false;
  }
}

// STEP 5: Save the artwork information in this browser.
let collection = [];
const collectionStatus = document.querySelector("#collectionStatus");
try {
  const saved = JSON.parse(localStorage.getItem("cabinetCollection") || "[]");
  if (Array.isArray(saved)) collection = saved.filter(function(item) {
    return item && typeof item === "object" && item.objectID;
  });
} catch (error) {
  collectionStatus.textContent = "Browser storage is unavailable. You can still download your collection.";
}

function addInformation(card, artwork, isSaved) {
  const fields = [
    ["Artist", artwork.artistDisplayName], ["Culture", artwork.culture],
    ["Period", artwork.period], ["Dimensions", artwork.dimensions],
    ["Department", artwork.department], ["Credit", artwork.creditLine],
    ["Accession number", artwork.accessionNumber]
  ];
  fields.forEach(function(field) {
    if (field[1]) {
      const paragraph = document.createElement("p");
      paragraph.className = "addedInfo";
      paragraph.textContent = field[0] + ": " + field[1];
      card.appendChild(paragraph);
    }
  });
  const button = document.createElement("button");
  button.className = "addedInfo";
  button.textContent = isSaved ? "Remove from collection" : "Save to my collection";
  button.addEventListener("click", function() {
    if (isSaved) {
      collection = collection.filter(function(item) { return item.objectID !== artwork.objectID; });
    } else if (!collection.some(function(item) { return item.objectID === artwork.objectID; })) {
      // Store the full returned record, including all titles and museum metadata.
      collection.push(artwork);
    } else {
      collectionStatus.textContent = "This artwork is already in your collection.";
      return;
    }
    try {
      localStorage.setItem("cabinetCollection", JSON.stringify(collection));
      collectionStatus.textContent = isSaved ? "Artwork removed." : "Artwork saved!";
    } catch (error) {
      collectionStatus.textContent = "Kept for this visit. Download a backup because browser storage is unavailable or full.";
    }
    showCollection();
  });
  card.appendChild(button);
}

function makeCard(artwork, isSaved) {
  const card = document.createElement("article");
  card.className = "artworkCard";
  const image = document.createElement("img");
  image.src = artwork.primaryImageSmall;
  image.alt = artwork.title || "Artwork from The Met";
  image.loading = "lazy";
  card.appendChild(image);
  const title = document.createElement("h2");
  title.textContent = artwork.title || "Untitled";
  card.appendChild(title);
  ["Date: " + (artwork.objectDate || "Unknown"), "Medium: " + (artwork.medium || "Unknown")].forEach(function(info) {
    const paragraph = document.createElement("p");
    paragraph.textContent = info;
    card.appendChild(paragraph);
  });
  const link = document.createElement("a");
  link.textContent = "View on The Met website";
  link.href = artwork.objectURL || "https://www.metmuseum.org/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  card.appendChild(link);
  addInformation(card, artwork, isSaved);
  return card;
}

function showCollection() {
  const cards = document.querySelector("#collectionCards");
  cards.replaceChildren();
  document.querySelector("#collectionCount").textContent = "(" + collection.length + ")";
  collection.forEach(function(artwork) { cards.appendChild(makeCard(artwork, true)); });
}
showCollection();

document.querySelector("#exportCollection").addEventListener("click", function() {
  const file = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-met-collection.json";
  link.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
});

// STEP 6: Search with a clue of your own.
document.querySelector("#customClueForm").addEventListener("submit", function(event) {
  event.preventDefault();
  const customClue = document.querySelector("#customClue").value.trim();
  if (!customClue) {
    statusText.textContent = "Type a clue first.";
    return;
  }
  choiceButtons.forEach(function(button) {
    button.classList.remove("selected");
  });
  selectedWord = customClue;
  selectedWordText.textContent = "Selected: " + selectedWord;
  statusText.textContent = "Your clue is ready. Open the mystery box!";
});
