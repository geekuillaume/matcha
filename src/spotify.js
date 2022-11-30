const SpotifyWebApi = require("spotify-web-api-node");
const sql = require("./sql");

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:8888/",
});

spotifyApi.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);
spotifyApi.setRefreshToken(process.env.SPOTIFY_REFRESH_TOKEN);

async function refreshSpotifyToken() {
  try {
    // only refresh it if needed (keep last refresh date in memory and look if the token is too old) -> OK
    // even better: keep accessToken in DB to prevent refreshing token when restarting server (optionnal mission) -> OK
    const lastRefresh = await sql.getLastSpotifyTokenRefresh();
    // console.log("date now : \n", Date.now());
    // console.log("lastrefresh : \n", lastRefresh[0].created_at);
    console.log(lastRefresh);
    if (!lastRefresh[0]) {
      const data = await spotifyApi.refreshAccessToken();
      console.log("The access token has been refreshed!");
      spotifyApi.setAccessToken(data.body["access_token"]);
      await sql.refreshSpotifyToken(data.body["access_token"]);
    } else if (Date.now() - lastRefresh[0].created_at >= 3600000) {
      const data = await spotifyApi.refreshAccessToken();
      console.log("The access token has been refreshed!");
      spotifyApi.setAccessToken(data.body["access_token"]);
      await sql.refreshSpotifyToken(data.body["access_token"]);
      await sql.deleteObsoleteSpotifyTokens();
    } else spotifyApi.setAccessToken(lastRefresh[0].token);
  } catch (err) {
    console.log("Could not refresh access token", err);
  }
}

async function fetchSpotifyCurrentPlayingTrack() {
  await refreshSpotifyToken();
  try {
    const data = (await spotifyApi.getMyCurrentPlayingTrack()).body.item;
    if (data) {
      const genredata = (await spotifyApi.getArtist(data.album.artists[0].id))
        .body.genres[0];
      const track = {
        name: data.name,
        artist: data.artists[0].name,
        album: data.album.name,
        id: data.id,
        duration_ms: data.duration_ms,
        genre: genredata,
        albumCoverUrl: data.album.images[0].url,
      };
      return track;
    }
  } catch (error) {
    console.log("Error fetching spotify data !\n", error);
  }
}

async function fetchAlbumCoverUrl(trackId) {
  return (await spotifyApi.getTrack(trackId)).body.album.images[0].url;
}

async function fetchArtistImageUrl(trackId) {
  // could do both operation in a single function and then call Promise.all on this function that does getTrack + getArtist -> OK
  const artistId = (await spotifyApi.getTrack(trackId)).body.artists[0].id;
  return (await spotifyApi.getArtist(artistId)).body.images[0].url;
}

module.exports = {
  refreshSpotifyToken,
  fetchSpotifyCurrentPlayingTrack,
  fetchAlbumCoverUrl,
  fetchArtistImageUrl,
};
