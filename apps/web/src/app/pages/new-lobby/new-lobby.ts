import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormatIcon } from '../../shared/format-icon/format-icon';
import { LOBBY_FORMATS } from '../../shared/format-icon/lobby-formats';

// Organizers land here after login: pick a format, then fill in its form.
@Component({
  selector: 'app-new-lobby',
  imports: [RouterLink, FormatIcon],
  templateUrl: './new-lobby.html',
  styleUrl: './new-lobby.css',
})
export class NewLobby {
  readonly options = [LOBBY_FORMATS.PICKUP, LOBBY_FORMATS.TOURNAMENT];
}
