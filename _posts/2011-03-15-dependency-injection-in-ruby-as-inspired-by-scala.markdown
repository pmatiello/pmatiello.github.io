---
layout: post
title:  "Dependency Injection in Ruby as inspired by Scala"
date:   2011-03-15 12:00:00
categories: dependency-injection ruby scala
---

A recent <a href="https://groups.google.com/d/topic/growing-object-oriented-software/7mVYbj1ZPzw/discussion">discussion</a> in the <a href="http://www.growing-object-oriented-software.com/">GOOS</a>' group has lead me to consider different ways to compose objects in Ruby. Specifically, as module inclusion seems to be the favored approach for adding stuff to classes in Ruby, I've became interested in finding a more flexible idiom for this.

The objective, therefore, is to define an instance variable in a module and be able to have it injected in instances of some class. Since I'm not that familiar with Ruby yet, I'm forced to turn to other languages for inspiration. A possible solution in Scala, presented below, is kind of intuitive.

Let's start defining a simple trait `Lightsource`.

{% highlight scala %}
trait Lightsource {
  def on
  def off
}
{% endhighlight %}

The goal is to have a instance of a class implementing this trait injected in every instance of the class `Room` below.

{% highlight scala %}
abstract class Room {
  val lightsource:Lightsource
  def enter = lightsource.on
  def leave = lightsource.off
}
{% endhighlight %}

The injection can be performed by mixing-in the `Room` class with traits designed to provide a `Lightsource`. For example:

{% highlight scala %}
trait FluorescentLamp {
  val lightsource = new Lightsource {
    def on = println("Sad light on")
    def off = println("Sad light off")
  }
}
{% endhighlight %}

The actual composition reads nicely:

{% highlight scala %}
val sadRoom = new Room with FluorescentLamp
{% endhighlight %}

If the fluorescent lamp is unsatisfactory, an alternative implementation can be provided:

{% highlight scala %}
trait IncandescentLamp {
  val lightsource = new Lightsource {
    def on = println("Warm light on")
    def off = println("Warm light off")
  }
}
{% endhighlight %}

{% highlight scala %}
val warmRoom = new Room with IncandescentLamp
{% endhighlight %}

And I will stop at this point. Although there is opportunity for improvement, the implementation is satisfactory enough for me.

Having succeeded at the Scala front, we can tackle the same issue using Ruby. Here, we find ourselves both unable and not required to declare interfaces, so we move directly to the definition of our `Room` class.

{% highlight ruby %}
class Room

  def enter
    @lightsource.on
  end

  def leave
    @lightsource.off
  end

end
{% endhighlight %}

The next step is to define a module responsible for providing an `@lightsource` object to instances of the Room` class. For instance:

{% highlight ruby %}
module FluorescentLamp
  class FluorescentLampImpl
    def on
      puts "Sad light on"
    end

    def off
      puts "Sad light off"
    end
  end

  def initialize(*args, &b)
    super
    @lightsource = FluorescentLampImpl.new
  end
end
{% endhighlight %}

Alternatively:

{% highlight ruby %}
module IncandescentLamp
  class IncandescentLampImpl
    def on
      puts "Warm light on"
    end

    def off
      puts "Warm light off"
    end
  end

  def initialize(*args, &b)
    super
    @lightsource = IncandescentLampImpl.new
  end
end
{% endhighlight %}

The actual composition does not read so nicely, but surely it can be improved by some sort of DSL. Being lazy, I'll skip that, though:

{% highlight ruby %}
sadRoom = Class.new(Room) do
  include FluorescentLamp
end.new

warmRoom = Class.new(Room) do
  include IncandescentLamp
end.new
{% endhighlight %}

Now, I'm suppose that this approach is not really within Ruby's orthodoxy, but I found it interesting nevertheless. Also, it surprised me that the Scala version is both cleaner and smaller than the Ruby version, while still providing the safety advantages of the static typing.
