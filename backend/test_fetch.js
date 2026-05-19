fetch('http://localhost:5000/api/subjects')
    .then(res => res.json())
    .then(data => {
        console.log("SUBJECTS FROM API:");
        console.log(data);
    })
    .catch(err => console.error(err));
