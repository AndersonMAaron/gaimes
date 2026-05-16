* Add spaces as possible letters in Spacey and Shifty keys
* Additions/Features
    * Punishing mode (no ghost keys allowed)
    * Dance Dance Revolution addon
        * Add numkey support
    * New mode: Double Keys
        * Keys are presented half as often for each difficulty, but instead of a single key a duo of 2 keys are required. Visually, both keys will display at equal horizontal position as they scroll with a visual connector between the two required keys. Additionally, in the center of that visualization will be an addtional slightly transparent visualization of the key combination that is larger than a normal key and displays "{key1}+{key2}"
        * The eventual plan is to fold this into Shifty keys. If we do, make sure the key placements are sp

New primary mode is TricKeys (is that our new name?), it's a combo of Shifty Keys, Double Keys, and Spacey Keys. It will keep the game split into measures but will alternate between types of measures. You could have a few shifty keys measures followed by a few spacey keys measures, etc. This will also allow us to mix in "minigame" measures "type the alphabet"

Let's rethink our approach to modes and modifiers. Straight Keys, Shifty Keys, Spacey Keys, and Double Keys all have the same foundational structure. They only differ in which modifier they present. Let's drop the game down to 2 modes (one of them being a new one). Straight Keys has modifiers that will need to be toggle-able on the main menu, while TricKeys currently has no additional options


== Straight Keys == 
Works the same as Straight Keys does today but condenses the redundant game modes into toggleable options
    * Shifty Keys (may include Shift modified keystrokes [Space excluded])
    * Double Keys (may include double key combinations)
    * Spacey Keys (always place space keys between beats) 

== TricKeys ==
This mode uses the same foundation and plays with the same ideas as Straight Keys but presents them in predetermined chunks (internally being thought of as Tricks). The game already builds an understanding of timing and rhythm so I'd like to generate a list of chains-of-measures that fit within the game's methodology (again, internally thinkingt of these chains-of-measures as Tricks). For example, I may play two measures of what has traditionally been called Straight Keys followed by four measures of what has been traditionally called Shifty Keys followed by two measures of Double Keys, etc. I'd like to experiment with adding in mini-games eventually to the middle of a song (like complete the alphabet within x measures) but lets stick with the random chaining of Tricks for now

    

#         EMPTY MEASURE         #
[- - - - - - - - - - - - - - - -]

### First 4 measures (all difficulties, warmup period) 
[- - - - - - - - - - - - - - - -][- - - - - - - - - - - - - - - -]
[- - - - - - - - - - - - - - - -][- - - - - - - - - - - - - - - -]

### Next measures
## Easy
[X - - - - - - - - - - - - - - -][X - - - - - - - - - - - - - - -]
[X - - - - - - - - - - - - - - -][X - - - - - - - - - - - - - - -]
[X - - - - - - - - - - - - - - -][x - - - - - - - - - - - - - - -]
[X - - - - - - - - - - - - - - -][X - - - - - - - - - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[- - - - - - - - - - - - - - - -][- - - - - - - - - - - - - - - -]
[X - - - - - - - - - - - - - - -][X - - - - - - - - - - - - - - -]

## Medium
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - - - - - - - - -][X - - - - - - - - - - - - - - -]
[X - - - X - - - X - - - X - - -][X - - - X - - - X - - - X - - -]
[- - - - - - - - - - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]

## Hard
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - X - - - X - - - X - - -][X - - - X - - - X - - - X - - -]
[X - - - - - - - X - - - - - - -][X - - - - - - - X - - - - - - -]
[X - - - X - - - X - - - X - - -][X - - - X - - - X - - - X - - -]
[X - - - - - - - - - - - - - - -][X - - - - - - - - - - - - - - -]
[X - - - X - - - X - - - X - - -][X - - - X - - - X - - - X - - -]
[X - - - X - - - X - - - X - - -][X - - - X - - - X - - - X - - -]


