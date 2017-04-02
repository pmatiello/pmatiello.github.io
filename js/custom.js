function enableClickToImage() {
    var images = document.getElementsByTagName('img');
    Array.from(images).forEach(function(image) {
        image.addEventListener('click', function(event) {
            window.location = event.target.getAttribute('src');
        });
    });
}

enableClickToImage();