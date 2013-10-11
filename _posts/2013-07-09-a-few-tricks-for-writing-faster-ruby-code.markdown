---
layout: post
title:  "A few tricks for writing faster Ruby code"
date:   2013-07-09 12:00:00
categories: performance ruby
---

Recently, I was busy at [work](http://www.baby.com.br) trying to make some Ruby code we've had written run faster. This is somewhat outside my zone of confort: I'm mostly concerned about design, correctness, testability, etc, and most of the time, my concerns about performance are restricted to proper choice of algorithms, data structures and caching strategies. Although I've done my share of profiling and performance improvements on Java applications, this was my first time doing something like that in Ruby. And as I haven't found much on this subject on Google, I decided to share here some of the stuff that proved themselves helpful to my problem.

## The benchmark module

The `benchmark` module, bundled with Ruby standard library, is an useful tool for deciding among candidate implementations based on performance. Basically, the module "provides methods to measure and report the time used to execute Ruby code" ([source](http://www.ruby-doc.org/stdlib-1.9.3/libdoc/benchmark/rdoc/Benchmark.html)), which is what you'd want in this situation.

The `Benchmark::bm` method, particularly, is quite convenient. You can setup a few different implementations, have them run, and then have their execution times reported. An example follows:

{% highlight ruby %}
Benchmark.bm do |x|
  x.report "Candidate #1" do
    candiate_one
  end
  x.report "Candidate #2" do
    candidate_two
  end
end
{% endhighlight %}

The produced output is something along the following format:

<pre>
               user       system     total      real
Candidate #1   6.260000   0.000000   6.260000   (6.260650)
Candidate #2   3.290000   0.000000   3.290000   (3.292514)
</pre>

This kind of measuring is unavoidable. First, attempts to improve the performance of a code may have the opposite effect, making it perform worse. Second, even tricks known to work well under a specific version of Ruby won't necessarily have the same effect on a different one.

Caveat emptor: All benchmarks here were executed under Ruby 1.9.3p385 on a Early 2011 MacBook Pro running OS X Mountain Lion. You may have different results when running these examples on a different environment.

## Embracing mutability

Immutability is, for many good reasons, considered a good practice. It usually results in cleaner, safer, more elegant code. It avoids a number of problems on concurrent programs. Yet, unfortunatelly, there may be a performance cost in avoiding mutable state. We can observe this by comparing the performance of [`String#downcase`](http://www.ruby-doc.org/core-1.9.3/String.html#method-i-downcase) and [`String#downcase!`](http://www.ruby-doc.org/core-1.9.3/String.html#method-i-downcase-21) against a list of 10 millions different strings. Both methods turn all letters of the original string into lowercase letters. The former, though, produces a new string and leaves the original one unchaged. The later performs the operation in place, modifying the original string.

{% highlight ruby %}
list = (1..10000000).map { |i| "Lorem ipsum dolor sit amet. #{i}" }
Benchmark.bm do |x|
  x.report "String#downcase" do
    list.each { |str| str.downcase  }
  end
  x.report "String#downcase!" do
    list.each { |str| str.downcase! }
  end
end
{% endhighlight %}

<pre>
                   user        system     total       real
String#downcase    10.970000   0.430000   11.400000   (11.393009)
String#downcase!   5.340000    0.040000   5.380000    ( 5.377566)
</pre>

Clearly, the mutable version is significantly faster — probably because it lacks the overhead of object construction and memory allocation.

## Accepting different semantics

Sometimes, some extra performance can be achieved by using solutions that offer a different, yet still similar, semantics. We can take, for instance, the [`Hash#fetch`](http://www.ruby-doc.org/core-1.9.3/Hash.html#method-i-fetch) method. This method kindly retrieves from a hash the value assigned to the given key. If no value is assigned, the method returns a specified fallback value.

{% highlight ruby %}
>> {:a => 1, :b => 2}.fetch(:a, 0)
=> 1
>> {:a => 1, :b => 2}.fetch(:c, 0)
=> 0

{% endhighlight %}

There is a simple alternative solution, using [`Hash#[]`](http://www.ruby-doc.org/core-1.9.3/Hash.html#method-i-5B-5D), with similar semantics, though:

{% highlight ruby %}
>> {:a => 1, :b => 2}[:a] || 0
=> 1
>> {:a => 1, :b => 2}[:c] || 0
=> 0

{% endhighlight %}

In fact, the `hash[key] || fallback` trick is indeed somewhat faster, as this benchmark shows:

{% highlight ruby %}
hash = {:a => 1, :b => 2, :c => 3}
Benchmark.bm do |x|
  x.report "fetch" do
    50000000.times { hash.fetch(:a, 0) }
  end
  x.report "[] ||" do
    50000000.times { hash[:a] || 0 }
  end
end
{% endhighlight %}

<pre>
        user       system     total      real
fetch   8.340000   0.000000   8.340000   (8.339169)
[] ||   5.100000   0.000000   5.100000   (5.100304)
</pre>

It's worth remembering, though, that even though the semantics of these two solutions are similar, in some cases they produce different results:

{% highlight ruby %}
>> {:key => false}.fetch(:key, true)
=> false
>> {:key => false}[:key] || true
=> true

{% endhighlight %}

I suppose that a decision regarding the use this optimization requires both careful measuring and reflection on whether the performance improvement is worth the risks involved.

## Memoization

[Memoization](http://en.wikipedia.org/wiki/Memoization) is an old and well-know technique to improve the performance of a program by storing the result of function calls so that repeated calls to the same function with previously processed parameters can just be fetched from memory instead of being recalculated.

A classical example is the algorithm for producing the [Fibonacci sequence](http://en.wikipedia.org/wiki/Fibonacci_number):

The mathematical definition for the *Fn* sequence of Fibonacci numbers is:

<pre>
F(n) = F(n-1) + F(n-2), for n > 1
F(1) = 1
F(0) = 0
</pre>

This definition has a very straightforward translation to Ruby:

{% highlight ruby %}
def fibonacci(n)
  n &lt;= 1 ? n : fibonacci(n-1) + fibonacci(n-2)
end
{% endhighlight %}

This is cute, but really slow. A calculation of `fibonacci(5)`, for instance, would involve the following calls:

<pre>
fibonacci(5) = fibonacci(4) + fibonacci(3)
	fibonacci(4) = fibonacci(3) + fibonacci(2)
		fibonacci(3) = fibonacci(2) + fibonacci(1)
			fibonacci(2) = fibonacci(1) + fibonacci(0)
				fibonacci(1) = 1
				fibonacci(0) = 0
	fibonacci(3) = fibonacci(2) + fibonacci(1)
		fibonacci(2) = fibonacci(1) + fibonacci(0)
			fibonacci(1) = 1
			fibonacci(0) = 0
</pre>

Here, we have a number of repeated calls. This isn't so bad for `n` = 5, but this effect is much, much worse for higher values of `n`. We can avoid all this repetition with a memoized version of the same algorithm:

{% highlight ruby %}
FIBONACCI_CACHE = {}
def memoized_fibonacci(n)
  FIBONACCI_CACHE[n] ||= (n &lt;= 1 ? n : memoized_fibonacci(n-1) + memoized_fibonacci(n-2))
end
{% endhighlight %}

Here are the running times for the original and memoized versions for `n` = 40:

<pre>
           user        system     total       real
original   24.210000   0.010000   24.220000   (24.215359)
memoized   0.000000    0.000000   0.000000    (0.000030)
</pre>

Things were a bit more complicated in the problem I was working on, though. The method I had to memoize returned `Hash` instances that were modified by the caller method. This is obviously problematic as a second call would receive a dirty, already modified, object instead of a good one. This was easily solved by returning a defensive copy of the memoized hash. Although `Object#clone` added some overhead, it was still much faster than recalculating the whole thing once again.

## Symbol#to_proc

Most of the time, in order to make some code run faster, we also make it uglier. This is kind of expected: if the beautiful solution is also fast, you're very likely already using it. This isn't, of course, true all the time. For some reason, I was expecting the cute [`Symbol#to_proc`](http://www.ruby-doc.org/core-2.0/Symbol.html#method-i-to_proc) trick to perform poorly, so I've tried changing it to explicit blocks. This proved to be a bad idea:

{% highlight ruby %}
Benchmark.bm do |x|
  x.report "to_proc" do
    (1..100000000).each &amp;:to_s
  end
  x.report "block" do
    (1..100000000).each { |n| n.to_s }
  end
end
{% endhighlight %}

<pre>
          user        system     total       real
to_proc   24.410000   0.010000   24.420000   (24.421814)
block     28.640000   0.010000   28.650000   (28.656124)
</pre>
